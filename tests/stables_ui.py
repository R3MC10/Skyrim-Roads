"""Horse breeds and stable upgrades: pick a breed, buy it, add saddlebags and horseshoes.
Usage: python3 stables_ui.py PORT"""
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
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=stab1"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Rider"); await pg.click("#begin"); await pg.wait_for_timeout(2500)
        await pg.evaluate("""()=>{ const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.gold=9000; delete S.horse;
          if(!S.discovered.includes('Whiterun')) S.discovered.push('Whiterun'); G.shopsOpen=()=>true; }""")
        for t in ["map", "town"]:
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())"); await pg.evaluate(f"document.querySelector('[data-tab={t}]').click()"); await pg.wait_for_timeout(400)
        for _ in range(6):
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove()); document.querySelectorAll('.toast,#toast').forEach(m=>m.remove())"); await pg.wait_for_timeout(400)
        await pg.evaluate("document.querySelector('[data-id=stables]')?.click()"); await pg.wait_for_timeout(600)
        ok(await pg.evaluate("document.querySelectorAll('[data-act=hbreed]').length") == 4, "four breeds to pick from")
        await pg.evaluate("document.querySelector('.hbreeds')?.scrollIntoView({block:'center'})"); await pg.wait_for_timeout(300)
        await pg.screenshot(path=OUT + "stables_breeds.png")
        await pg.click("[data-act=hbreed][data-id=courser]"); await pg.wait_for_timeout(300)
        ok("Hammerfell courser" in await pg.text_content("[data-act=hbuy]"), "buy button names the breed")
        await pg.fill("#hname", "Sirocco"); await pg.click("[data-act=hbuy]"); await pg.wait_for_timeout(400)
        h = await pg.evaluate("window.__dbg.save().horse")
        ok(h and h["breed"] == "courser" and h["stats"]["speed"] > 1.9, f"bought a courser: {h and h['stats']}")
        await pg.click("[data-act=hbags]"); await pg.wait_for_timeout(300)
        await pg.click("[data-act=hshoes][data-id=steel]"); await pg.wait_for_timeout(300)
        h = await pg.evaluate("window.__dbg.save().horse")
        ok(h["bags"] == 1 and h["shoes"] == "steel", "saddlebags and steel shoes fitted")
        ok(await pg.evaluate("HORSES.carry(window.__dbg.save())") >= 115, "carry went up")
        await pg.wait_for_timeout(6000); await pg.evaluate("document.querySelector('.hstats')?.closest('.card')?.scrollIntoView({block:'start'})"); await pg.wait_for_timeout(400)
        await pg.screenshot(path=OUT + "stables.png")
        ok(not errs, f"no page errors {errs}")
        await b.close()
    print("RESULT", "OK" if not fails else f"FAIL {len(fails)}")
asyncio.run(main())
