"""Popups don't flicker: with motion on, the sheet stays fully visible after its open animation ends.
Usage: python3 popflicker_ui.py PORT"""
import asyncio, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        pg = await (await b.new_context(viewport={"width": 412, "height": 915})).new_page()
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&motion&p=flick1"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Flick"); await pg.click("#begin"); await pg.wait_for_timeout(2500)
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        ok(await pg.evaluate("document.documentElement.classList.contains('mo-on')"), "motion is on")
        rows = await pg.evaluate("""()=>new Promise(res=>{ const b=document.createElement('button'); b.dataset.act='dollslot'; b.dataset.slot='head'; document.getElementById('side').appendChild(b); b.click();
          const out=[], t0=performance.now(); (function f(){ const s=document.querySelector('#modal .sheet'); if(s) out.push([performance.now()-t0, +getComputedStyle(s).opacity]); if(performance.now()-t0<1000) requestAnimationFrame(f); else res(out); })(); })""")
        late = [o for t, o in rows if t > 400]
        ok(late and min(late) > 0.99, f"the equipment slot popup stays visible after opening (lowest {min(late) if late else None})")
        ok(not errs, f"no page errors {errs}")
        await b.close()
    print("RESULT", "OK" if not fails else f"FAIL {len(fails)}")
asyncio.run(main())
