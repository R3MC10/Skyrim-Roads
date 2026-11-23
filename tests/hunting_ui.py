"""Hunting: the 🏹 button on the map turns it on; on the road a deer turns up as a fight.
Usage: python3 hunting_ui.py PORT"""
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
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=hunt1"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Hunter"); await pg.click("#begin"); await pg.wait_for_timeout(2500)
        for _ in range(4):
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove()); document.querySelectorAll('.toast,#toast').forEach(m=>m.remove())"); await pg.wait_for_timeout(300)
        await pg.evaluate("document.querySelector('[data-tab=map]').click()"); await pg.wait_for_timeout(400)
        ok(await pg.query_selector("#huntBtn") is not None, "the hunt button is on the map")
        await pg.evaluate("document.querySelector('#huntBtn').click()"); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("window.__dbg.save().hunting") is True, "hunting is on")
        ok(await pg.evaluate("document.querySelector('#huntBtn').classList.contains('on')"), "the button lights up")
        await pg.evaluate("""()=>{ const S=window.__dbg.save(); G.startTrip(S,'Riverwood',WORLD.places.Riverwood);
          const e=G.scaleEnemy(HUNT.pick(S,()=>0.05),S.level); e.hold='Whiterun'; S.trip.status='encounter'; S.trip.encounter=e; }""")
        await pg.evaluate("document.querySelector('[data-tab=town]').click()"); await pg.wait_for_timeout(200)
        await pg.evaluate("document.querySelector('[data-tab=map]').click()"); await pg.wait_for_timeout(900)
        txt = await pg.evaluate("document.body.innerText")
        ok("Deer" in txt, "a deer on the road")
        await pg.evaluate("scrollTo(0,0)"); await pg.wait_for_timeout(300)
        await pg.screenshot(path=OUT + "hunting.png")
        ok(not errs, f"no page errors {errs}")
        await b.close()
    print("RESULT", "OK" if not fails else f"FAIL {len(fails)}")
asyncio.run(main())
