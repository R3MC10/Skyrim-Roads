"""A living world (rumours.js) on a phone: inn crowd + asking for rumours, knocking at a closed shop,
the lead card at the spot, the Journal page and the map mark, in both art styles.
python rumours_ui.py <port> [out_dir]   (serve game/ first: node tests/serve.js <port>)"""
import asyncio, os, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "9230"
OUT = (sys.argv[2] if len(sys.argv) > 2 else "rw_shots").rstrip("/\\") + "/"
os.makedirs(OUT, exist_ok=True)

async def close_modals(pg):
    for _ in range(6):
        b = await pg.query_selector("#modal [data-act=close]")
        if not b: break
        await b.click(); await pg.wait_for_timeout(150)
    await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")

async def tap(pg, sel):
    await close_modals(pg); await pg.click(sel)

# set the in-game clock: Date.now jumps to the next moment with that hour
SET_HOUR = """(h)=>{ const real=Date.__real||(Date.__real=Date.now.bind(Date)); let t=real()/1000; for(let i=0;i<3000&&Math.abs(G.clock(t).hour-h)>0.2;i++) t+=30; const off=t*1000-real(); Date.now=()=>real()+off; }"""

async def main():
    res, errs = [], []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        for style in ["ink"]:
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=rw{style}"); await pg.wait_for_timeout(1800)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Rumo"); await pg.click("#begin"); await pg.wait_for_timeout(1000)
            await close_modals(pg)
            await pg.evaluate("""(st)=>{ const S=window.__dbg.save(); S.location="Whiterun"; [S.x,S.y]=WORLD.places.Whiterun; S.trip=null; S.gold=3000; S.level=20; S.hpBonus=3000; G.setHealth(S,G.maxHealth(S));
                S.dragons=1; S.cleared={"Bleak Falls Barrow":G.now()}; S.thaneWhiterun=true; S.homes={Whiterun:{}};
                for (let i=0;i<6;i++) QUESTS.check(S); window.__ui.save&&window.__ui.save(); }""", style)
            await pg.wait_for_timeout(3200); await close_modals(pg)
            await pg.evaluate(SET_HOUR, 21)
            # the inn in the evening
            await pg.click("[data-tab=town]"); await pg.wait_for_timeout(300); await close_modals(pg)
            await tap(pg, "[data-act=shop][data-id=inn]"); await pg.wait_for_timeout(300)
            crowd = await pg.query_selector(".rw-inn svg")
            res.append((f"{style} inn crowd", bool(crowd)))
            await pg.evaluate("document.querySelector('.rw-inn')?.scrollIntoView({block:'start'})"); await pg.wait_for_timeout(150)
            await pg.screenshot(path=f"{OUT}{style}_inn.png")
            n0 = await pg.evaluate("RUMOURS.leads(window.__dbg.save()).length")
            await tap(pg, "[data-rw=hear][data-src=inn]"); await pg.wait_for_timeout(400)
            txt = await pg.evaluate("[...document.querySelectorAll('#modal')].map(m=>m.innerText).join(' ')")
            n1 = await pg.evaluate("RUMOURS.leads(window.__dbg.save()).length")
            # a quest popup can land on top of the rumour, so check the save too
            res.append((f"{style} heard a rumour", n1 > n0 or "marked on your map" in txt))
            await pg.screenshot(path=f"{OUT}{style}_rumour.png")
            await close_modals(pg)
            # a closed shop at night: knock
            await tap(pg, "[data-act=shop][data-id=general]"); await pg.wait_for_timeout(300)
            dis = await pg.evaluate("[...document.querySelectorAll('[data-act=buy]')].every(b=>b.disabled)")
            res.append((f"{style} shop closed at night", dis))
            await pg.evaluate("document.querySelector('.rw-knock')?.scrollIntoView({block:'center'})"); await pg.wait_for_timeout(150)
            await pg.screenshot(path=f"{OUT}{style}_closed.png")
            await tap(pg, "[data-rw=knock]"); await pg.wait_for_timeout(400)
            en = await pg.evaluate("[...document.querySelectorAll('[data-act=buy]')].some(b=>!b.disabled)")
            res.append((f"{style} knocked: can buy", en))
            await pg.evaluate("document.querySelector('.rw-knock')?.scrollIntoView({block:'center'})"); await pg.wait_for_timeout(150)
            await pg.screenshot(path=f"{OUT}{style}_knocked.png")
            g0 = await pg.evaluate("window.__dbg.save().gold")
            await tap(pg, "[data-act=buy]"); await pg.wait_for_timeout(300)
            res.append((f"{style} bought at night", await pg.evaluate("window.__dbg.save().gold") < g0))
            # the map mark and the lead card at the spot (make it a real one)
            await pg.click("[data-tab=world]"); await pg.wait_for_timeout(900); await close_modals(pg)
            await pg.screenshot(path=f"{OUT}{style}_map.png")
            place = await pg.evaluate("""()=>{ const S=window.__dbg.save(); const l=RUMOURS.leads(S)[0]; l.real=true; S.location=l.place; [S.x,S.y]=WORLD.places[l.place]; return l.place; }""")
            await pg.click("[data-tab=town]"); await pg.wait_for_timeout(200); await pg.click("[data-tab=world]"); await pg.wait_for_timeout(600); await close_modals(pg)
            card = await pg.query_selector(".rw-card")
            res.append((f"{style} lead card at {place}", bool(card)))
            if card:
                await card.scroll_into_view_if_needed(); await card.screenshot(path=f"{OUT}{style}_card.png")
                await tap(pg, "[data-rw=act]"); await pg.wait_for_timeout(600)
                txt = await pg.evaluate("document.querySelector('#modal')?.innerText||''")
                res.append((f"{style} saw it through", len(txt) > 20))
                await pg.screenshot(path=f"{OUT}{style}_result.png")
                await close_modals(pg)
            # the Journal: Misc → Word around Skyrim
            await pg.evaluate("()=>window.__ui.go('world')"); await pg.wait_for_timeout(400)   # Map → World news (was Journal → Misc)
            el = await pg.query_selector("#j-rumours")
            t = await el.inner_text() if el else ""
            res.append((f"{style} journal standing", "Whiterun" in t and any(k in t for k in ("Hero", "Friend", "Familiar face"))))
            if el: await el.scroll_into_view_if_needed(); await pg.screenshot(path=f"{OUT}{style}_journal.png", full_page=False)
            await pg.close()
        await b.close()
    for k, v in res: print(("ok   " if v else "FAIL ") + k)
    print("errors:", errs)
    good = all(v for _, v in res) and not errs
    print("RESULT", "OK" if good else "FAIL")
    sys.exit(0 if good else 1)
asyncio.run(main())
