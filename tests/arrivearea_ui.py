"""Arriving opens the Area tab (arrivearea.js): a short real trip ends in Riverwood and the Area tab lights up, on a phone
   (390x844) and a PC (1440x900); a window open on arrival holds the switch until it closes; a roam spot keeps the map.
   usage: python3 arrivearea_ui.py [port] [shots dir]   (shots in tests/out_arrivearea/ unless given)"""
import asyncio, os, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_arrivearea")
os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
fails = []
def check(ok, what):
    print(("ok   " if ok else "FAIL ") + what)
    if not ok: fails.append(what)

TRIP = """(dest)=>{const S=window.__dbg.save(); document.querySelectorAll('#modal').forEach(m=>m.remove());
  S.trip=null; S.dungeon=null; S.location=null; const p=WORLD.places[dest]||dest; S.x=p[0]+0.004; S.y=p[1]+0.003;
  const err=G.startTrip(S, Array.isArray(dest)?'__spot':dest, p); window.__ui.refresh(); return err||''}"""
ON = "()=>document.querySelector('#tabs .tab.on')?.dataset.tab"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(**({"executable_path": CHROME} if CHROME else {}), args=["--no-sandbox"])
        for (w, h, tag) in [(390, 844, "phone"), (1440, 900, "pc")]:
            ctx = await b.new_context(viewport={"width": w, "height": h}, is_mobile=(tag == "phone"), has_touch=(tag == "phone"))
            pg = await ctx.new_page(); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&p=arr{tag}&notut"); await pg.wait_for_timeout(1500)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Remi"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            await pg.evaluate("document.querySelector('[data-tab=map]').click()"); await pg.wait_for_timeout(300)

            # 1. a plain arrival: Area opens by itself
            err = await pg.evaluate(TRIP, "Riverwood")
            check(err == "", f"{tag}: trip to Riverwood starts ({err})")
            for _ in range(40):
                await pg.wait_for_timeout(500)
                if await pg.evaluate("()=>!window.__dbg.save().trip"): break
            await pg.wait_for_timeout(800)
            loc = await pg.evaluate("()=>window.__dbg.save().location")
            check(loc == "Riverwood", f"{tag}: arrived in Riverwood ({loc})")
            on = await pg.evaluate(ON)
            check(on == "town", f"{tag}: the Area tab is active after arriving ({on})")
            check(await pg.evaluate("()=>document.querySelector('#side').dataset.tab") == "town", f"{tag}: the Area screen shows")
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            await pg.wait_for_timeout(300)
            await pg.screenshot(path=f"{OUT}/arrive_{tag}.png")

            # 2. a window open on arrival: the switch waits for it
            await pg.evaluate("document.querySelector('[data-tab=map]').click()"); await pg.wait_for_timeout(300)
            await pg.evaluate(TRIP, "Whiterun")
            await pg.evaluate("()=>window.__dbg.message('Test', 'A window that is open while you arrive.')")
            for _ in range(60):
                await pg.wait_for_timeout(500)
                if await pg.evaluate("()=>!window.__dbg.save().trip"): break
            await pg.wait_for_timeout(800)
            held = await pg.evaluate(ON)
            hasModal = await pg.evaluate("()=>!!document.querySelector('#modal .sheet')")
            check(hasModal and held == "map", f"{tag}: with a window open the tab waits ({held}, window {hasModal})")
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            await pg.wait_for_timeout(1200)
            check(await pg.evaluate(ON) == "town", f"{tag}: once the window closes, Area opens")

            # 3. a roam spot: stay on the map
            await pg.evaluate("document.querySelector('[data-tab=map]').click()"); await pg.wait_for_timeout(300)
            spot = await pg.evaluate("()=>{const p=WORLD.places.Whiterun; return [p[0]+0.03, p[1]+0.03]}")
            await pg.evaluate(TRIP, spot)
            for _ in range(40):
                await pg.wait_for_timeout(500)
                if await pg.evaluate("()=>!window.__dbg.save().trip"): break
            await pg.wait_for_timeout(800)
            check(await pg.evaluate(ON) == "map", f"{tag}: a roam spot keeps the map")
            check(errs == [], f"{tag}: no page errors {errs[:2]}")
            await ctx.close()
        await b.close()
    print("arrivearea_ui:", "FAILED " + str(len(fails)) if fails else "all ok")
    sys.exit(1 if fails else 0)

asyncio.run(main())
