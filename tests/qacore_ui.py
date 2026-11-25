"""Core-loop QA sweep (qa-core), real taps on a phone (390x844): the back button steps out of the barber, a mini-game
   (fishing) and a shop one level at a time instead of reaching the compass or minimising the app.
   usage: python3 qacore_ui.py [port]"""
import asyncio, os, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
CHROME = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
fails = []
def check(ok, what):
    print(("ok   " if ok else "FAIL ") + what)
    if not ok: fails.append(what)

CLEAR = "document.querySelectorAll('#modal').forEach(m=>m.remove())"
IDS = "()=>[...document.querySelectorAll('body>[id]')].map(e=>e.id)"

async def board(pg):
    await pg.evaluate("()=>{ if(typeof TABMENU!=='undefined') TABMENU.closeHub(); window.__ui.go('town'); window.scrollTo(0,0) }")
    await pg.wait_for_timeout(300); await pg.evaluate(CLEAR)
    await pg.evaluate("()=>document.querySelector('#side .au-back')?.click()"); await pg.wait_for_timeout(300)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(**({"executable_path": CHROME} if CHROME else {}), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        pg = await ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?p=qacore&notut&games"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Remi"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        await pg.evaluate("""()=>{const S=window.__dbg.save(); const p=WORLD.places.Whiterun; S.x=p[0]; S.y=p[1]; S.location='Whiterun'; S.gold=500;
          G.give(S,'fishing_rod'); window.__ui.refresh()}""")
        await pg.wait_for_timeout(1200); await pg.evaluate(CLEAR)

        # 1. a shop: back goes to the town's board first
        await board(pg)
        await pg.click("#side [data-act=shop][data-id=inn]"); await pg.wait_for_timeout(300)
        check(await pg.evaluate("!!document.querySelector('#side .au-back')"), "the inn is open")
        check(await pg.evaluate("window.__ui.back()"), "back is handled in the inn")
        await pg.wait_for_timeout(300)
        check(await pg.evaluate("!document.querySelector('#side .au-back') && !document.querySelector('#tw') && !!document.querySelector('#side [data-act=shop][data-id=inn]')"), "back from the inn shows the town board, not the compass")

        # 2. the barber: back = cancel, gold untouched
        await pg.click("#side [data-act=shop][data-id=inn]"); await pg.wait_for_timeout(300)
        await pg.evaluate(CLEAR)
        g0 = await pg.evaluate("window.__dbg.save().gold")
        await pg.click("#side [data-act=barber]"); await pg.wait_for_timeout(500)
        check(await pg.evaluate("!!document.querySelector('.cg-over')"), "the barber opens")
        await pg.evaluate("window.__ui.back()"); await pg.wait_for_timeout(300)
        check(await pg.evaluate("!document.querySelector('.cg-over') && !document.querySelector('#tw')"), "back closes the barber and nothing else")
        check(await pg.evaluate("window.__dbg.save().gold") == g0, "the barber charged nothing")

        # 3. fishing: back leaves the mini-game
        await board(pg)
        await pg.click("#side [data-act=shop][data-id=fish]"); await pg.wait_for_timeout(300); await pg.evaluate(CLEAR)
        await pg.click("#side [data-act=fishgo]"); await pg.wait_for_timeout(800)
        check("fishgame" in await pg.evaluate(IDS), "fishing opens")
        r = await pg.evaluate("window.__ui.back()"); await pg.wait_for_timeout(500)
        ids = await pg.evaluate(IDS)
        check(r and "fishgame" not in ids and "tw" not in ids, f"back leaves fishing ({ids})")
        check(errs == [], f"no page errors {errs[:2]}")
        await b.close()
    print("qacore_ui:", "FAILED " + str(len(fails)) if fails else "all ok")
    sys.exit(1 if fails else 0)

asyncio.run(main())
