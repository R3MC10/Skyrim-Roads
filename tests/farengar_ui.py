"""Farengar takes the Dragonstone in Whiterun's Court wizard shop.
Usage: python3 farengar_ui.py PORT"""
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
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=farengar1"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Buyer"); await pg.click("#begin"); await pg.wait_for_timeout(2500)
        await pg.evaluate("""()=>{ document.querySelectorAll('#modal').forEach(m=>m.remove()); const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.gold=5000;
          if(!S.discovered.includes('Whiterun')) S.discovered.push('Whiterun'); G.shopsOpen=()=>true; }""")
        await pg.click("[data-tab=map]"); await pg.click("[data-tab=town]"); await pg.wait_for_timeout(400)
        for _ in range(6):
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove()); document.querySelectorAll('.toast,#toast').forEach(m=>m.remove())"); await pg.wait_for_timeout(500)
        await pg.evaluate("document.querySelector('[data-act=shop][data-id=wizard]')?.click()"); await pg.wait_for_timeout(900)
        txt = await pg.evaluate("document.body.innerText")
        ok("Farengar" in txt, "Farengar is in the Court wizard shop")
        ok(await pg.evaluate("document.querySelector('[data-act=dragonstone]').disabled"), "Give it is greyed out without the stone")
        await pg.evaluate("G.give(window.__dbg.save(),'dragonstone'); document.querySelector('[data-act=shop][data-id=wizard]').click()"); await pg.wait_for_timeout(600)
        await pg.click("[data-act=dragonstone]"); await pg.wait_for_timeout(800)
        ok(await pg.evaluate("window.__dbg.save().thaneWhiterun===true && !window.__dbg.save().inv.some(x=>x.item==='dragonstone')"), "handing it in finishes the quest")
        await pg.screenshot(path=OUT + "farengar.png")
        ok(not errs, f"no page errors {errs}")
        await b.close()
    print("RESULT", "OK" if not fails else f"FAIL {len(fails)}")
asyncio.run(main())
