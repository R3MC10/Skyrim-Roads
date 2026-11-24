"""UX clarity pass: next-step card, Go from it, grouped Town + shop, help popovers on every tab, Pack search, Journal folds.
   usage: python3 ux_ui.py [port]"""
import asyncio, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
fails = []
def check(ok, what):
    print(("ok   " if ok else "FAIL ") + what)
    if not ok: fails.append(what)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844})
        errs = []
        async def clear(pg): await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        async def tab(pg, t):
            await clear(pg); await pg.evaluate(f"document.querySelector('[data-tab={t}]').click()"); await pg.wait_for_timeout(400); await clear(pg)
        async def js(pg, code): await clear(pg); await pg.evaluate(code); await pg.wait_for_timeout(250); await clear(pg)

        # ---- new player
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&p=uxt1"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Remi"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        await clear(pg); await tab(pg, "map")
        card = await pg.evaluate("document.querySelector('.nextcard')?.innerText || ''")
        check("What to do next" in card.title() or "WHAT TO DO NEXT" in card.upper(), "next-step card on Travel")
        check("Before the Storm" in card, "card shows the current quest goal")
        rows = await pg.evaluate("document.querySelectorAll('.panel:not(.nextcard) [data-act=go]').length")
        check(rows <= 9, f"place list shows only the nearest ({rows})")
        if await pg.query_selector("[data-act=uxall]"):
            await js(pg, "document.querySelector('[data-act=uxall]').click()")
            rows2 = await pg.evaluate("document.querySelectorAll('.panel:not(.nextcard) [data-act=go]').length")
            check(rows2 > rows, f"'Show all' lists more places ({rows2})")
        dest = await pg.evaluate("document.querySelector('.nextcard [data-act=go]')?.dataset.place")
        check(dest == "Whiterun", f"Go button in the card leads to the quest goal ({dest})")
        await js(pg, "document.querySelector('.nextcard [data-act=go]').click()")
        trip = await pg.evaluate("window.__dbg.save().trip?.destName")
        check(trip == "Whiterun", f"pressing Go starts the trip ({trip})")
        # arrive, then Town groups and a shop
        await pg.evaluate("()=>{const S=window.__dbg.save(); S.trip=null; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.gold=500;}")
        await pg.wait_for_timeout(300); await tab(pg, "map"); await tab(pg, "town")
        heads = await pg.evaluate("[...document.querySelectorAll('.au-g .au-gh')].map(e=>e.textContent)")
        check({"Inn", "Market", "Services & trainers"} <= set(heads), f"town groups {heads}")
        await js(pg, "document.querySelector('.au-tile[data-act=shop][data-id=general]').click()")
        check(await pg.evaluate("!!document.querySelector('.tg-desc')"), "open section has a description")
        check(await pg.evaluate("document.querySelector('.au-sibs [data-act=shop][data-id=general]').classList.contains('on')"), "General goods opens")
        # help popovers on each tab
        for t in ["map", "hero", "tactics", "town", "log"]:
            if not await pg.query_selector(f"[data-tab={t}]"): continue   # tabs that moved into other screens
            await tab(pg, t)
            await js(pg, "document.querySelector('.uxhead .uxi').click()")
            txt = await pg.evaluate("document.querySelector('.uxpop')?.innerText || ''")
            check(len(txt) > 40, f"ⓘ help on {t}")
            await js(pg, "document.querySelector('.uxpop [data-act=uxhelp]').click()")
            check(not await pg.query_selector(".uxpop"), f"help on {t} closes")
        lbl = await pg.evaluate("[...document.querySelectorAll('.top .ibl')].map(e=>e.textContent).join(',')")
        check(lbl == "Friends,Menu", f"top icons labelled ({lbl})")
        await pg.close()

        # ---- mid-game: Pack search and Journal folds
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&p=uxt2&notut"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Mira"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        await pg.evaluate("""()=>{const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.level=22; S.gold=4000;
            G.give(S,'gem_ruby',3); G.give(S,'steel_sword'); G.give(S,'mat_iron',6); G.give(S,'potion_health',4);}""")
        await pg.wait_for_timeout(300); await tab(pg, "pack"); await pg.wait_for_timeout(300)
        check(await pg.query_selector("#skysearch") is not None, "Pack has a search box")
        await pg.fill("#skysearch", "steel"); await pg.wait_for_timeout(300)
        names = await pg.evaluate("[...document.querySelectorAll('#sky .sky-row .nm')].map(e=>e.textContent)")
        check(len(names) >= 1 and all("steel" in n.lower() for n in names), f"search filters items {names}")
        check(await pg.evaluate("document.activeElement?.id") == "skysearch", "search box keeps focus while typing")
        await pg.fill("#skysearch", "zzzz"); await pg.wait_for_timeout(200)
        empty = await pg.evaluate("document.querySelector('#sky .sky-empty')?.innerText || ''")
        check("zzzz" in empty, "search empty state says what happened")
        await pg.evaluate("document.querySelector('#sky .sky-i').click()"); await pg.wait_for_timeout(200)
        check(await pg.query_selector("#sky .uxpop") is not None, "ⓘ help in the Pack menu")
        await pg.evaluate("document.querySelector('[data-act=skyclose]').click()"); await pg.wait_for_timeout(300)
        await tab(pg, "log")
        # the Journal is quests only now (Active / Misc / Completed); the old folded sections moved out
        check(await pg.query_selector("#side .jseg [data-id=active]") is not None, "journal has Active/Misc/Completed tabs")
        badge = await pg.evaluate("document.querySelector('.jseg [data-id=active] .jbadge')?.textContent")
        check(badge is not None, f"active quests badge ({badge})")
        check(await pg.query_selector("#j-log") is None, "the diary moved out of the Journal")
        await pg.close()
        check(not errs, f"no page errors {errs}")
        await b.close()
    print("RESULT", "OK" if not fails else "FAIL " + "; ".join(fails))
asyncio.run(main())
