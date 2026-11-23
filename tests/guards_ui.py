"""Hold guards on the map: a patrol walks out of Whiterun and shows up near places you've found.
Usage: python3 guards_ui.py PORT"""
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
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=grd1"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Watcher"); await pg.click("#begin"); await pg.wait_for_timeout(2500)
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        # freeze the clock where Whiterun's patrol is halfway out on its road
        await pg.evaluate("""()=>{ const b=GUARDS.beat('Whiterun'), cyc=2*(GUARDS.STOP+b.secs), t=G.now(), off=((t-1795132800)%cyc+cyc)%cyc;
          const want=GUARDS.STOP+b.secs*0.5; window.__gt=t-off+want; const real=GUARDS.visible; GUARDS.visible=(s)=>real(s, window.__gt);
          const S=window.__dbg.save(); for (const n of ['Whiterun','Riverwood','Rorikstead']) if(!S.discovered.includes(n)) S.discovered.push(n);
          const pp=GUARDS.patrols(window.__gt).find(p=>p.hold==='Whiterun'); S.location='Riverwood'; [S.x,S.y]=WORLD.places.Riverwood; window.__pp=pp; }""")
        await pg.click("[data-tab=map]"); await pg.wait_for_timeout(800)
        vis = await pg.evaluate("GUARDS.visible(window.__dbg.save()).filter(p=>p.visible).map(p=>p.hold).join(',')")
        ok("Whiterun" in vis, "Whiterun's patrol is on the map: " + vis)
        box = await (await pg.query_selector("#mapwrap canvas, #map canvas, canvas")).bounding_box()
        cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
        await pg.mouse.move(cx, cy)
        for _ in range(6): await pg.mouse.wheel(0, -300); await pg.wait_for_timeout(120)
        await pg.wait_for_timeout(4500)
        print("patrol", await pg.evaluate("JSON.stringify(window.__pp)"))
        el = await pg.query_selector("#mapwrap") or await pg.query_selector("canvas")
        await el.screenshot(path=OUT + "guards_map.png")
        ok(not errs, f"no page errors {errs}")
        await b.close()
    print("RESULT", "OK" if not fails else f"FAIL {len(fails)}")
asyncio.run(main())
