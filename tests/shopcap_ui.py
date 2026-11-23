"""Traders sell the basics: Whiterun's blacksmith shows iron and steel, nothing finer.
Usage: python3 shopcap_ui.py PORT"""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tbf") + os.sep
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)
async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2, has_touch=True)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=shop1"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Buyer"); await pg.click("#begin"); await pg.wait_for_timeout(2500)
        await pg.evaluate("""()=>{ document.querySelectorAll('#modal').forEach(m=>m.remove()); const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.gold=5000;
          if(!S.discovered.includes('Whiterun')) S.discovered.push('Whiterun'); G.shopsOpen=()=>true; }""")
        await pg.click("[data-tab=map]"); await pg.click("[data-tab=town]"); await pg.wait_for_timeout(400)
        for _ in range(6):
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove()); document.querySelectorAll('.toast,#toast').forEach(m=>m.remove())"); await pg.wait_for_timeout(500)
        await pg.evaluate("document.querySelector('[data-act=shop][data-id=blacksmith]')?.click()"); await pg.wait_for_timeout(900)
        print("modal:", await pg.evaluate("(document.querySelector('#modal')||{}).innerText?.slice(0,80)"))
        txt = await pg.evaluate("document.body.innerText")
        ok("Steel Sword" in txt or "Iron Sword" in txt, "the blacksmith sells iron and steel")
        ok(not any(any(w in l for w in ["Elven", "Dwarven", "Glass", "Ebony", "Daedric"]) and "invasion" not in l for l in txt.split(chr(10))), "nothing finer")
        r = await pg.evaluate("G.buy(window.__dbg.save(),'elven_sword',1)")
        ok("basic gear" in r, "asking for an elven sword: " + r)
        await pg.evaluate("document.querySelector('.barter-head')?.scrollIntoView({block:'start'})"); await pg.wait_for_timeout(500)
        await pg.screenshot(path=OUT + "shopcap.png")
        ok(not errs, f"no page errors {errs}")
        await b.close()
    print("RESULT", "OK" if not fails else f"FAIL {len(fails)}")
asyncio.run(main())
