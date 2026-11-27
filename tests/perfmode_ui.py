"""Settings → Performance (perfmode.js): Battery saver and Show performance. Usage: python perfmode_ui.py PORT
Checks: both rows show in Settings; Show performance puts the corner readout up and takes it away; Battery saver
caps the fight frame rate and quality (fightset.js) and the canvas density (fitcanvas.js); phones default to Medium/30 fps."""
import asyncio, sys
from playwright.async_api import async_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"

async def main():
    fails, errs = [], []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=3, has_touch=True)
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=perfmodeui")
        await pg.wait_for_selector(".press")
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Perfmo"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        def ok(c, m):
            if not c: fails.append(m)
        d = await pg.evaluate("()=>({ q: FIGHTSET.quality(), f: FIGHTSET.fps(), ph: PERFMODE.phone(), dpr: FITCANVAS.dpr(), sv: PERFMODE.saver() })")
        ok(d["ph"] and d["q"] == "med" and d["f"] == 30, f"phone defaults Medium/30: {d}")
        ok(not d["sv"], "saver off by default")
        # the Settings rows
        html = await pg.evaluate("()=>PERFMODE.settingsHTML((k,o,c)=>o.map(([v,l])=>`<button data-act=pref data-k=${k} data-v=${v}>${l}</button>`).join(''))")
        ok("battSaver" in html and "perfHud" in html, "settings rows")
        # show performance
        await pg.evaluate("()=>PERFMODE.pref('perfHud', 'true')"); await pg.wait_for_timeout(2300)
        t = await pg.evaluate("()=>document.getElementById('perfhud')?.textContent || ''")
        ok("fps" in t, f"readout shows fps: {t!r}")
        await pg.evaluate("()=>PERFMODE.pref('perfHud', 'false')"); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("()=>!document.getElementById('perfhud')"), "readout goes away")
        # battery saver
        await pg.evaluate("()=>{ PERFMODE.pref('battSaver', 'true'); const p=JSON.parse(localStorage.getItem('rotn_prefs')||'{}'); p.fsQuality='high'; p.fsFps=0; localStorage.setItem('rotn_prefs', JSON.stringify(p)); }")
        await pg.wait_for_timeout(600)
        d = await pg.evaluate("()=>({ q: FIGHTSET.quality(), f: FIGHTSET.fps(), dpr: FITCANVAS.dpr(), g: PERFMODE.gap(33), cls: document.documentElement.classList.contains('battsaver') })")
        ok(d["q"] == "med" and d["f"] == 30 and d["dpr"] <= 1.6 and d["g"] > 33 and d["cls"], f"saver caps: {d}")
        await pg.evaluate("()=>PERFMODE.pref('battSaver', 'false')"); await pg.wait_for_timeout(600)
        d = await pg.evaluate("()=>({ q: FIGHTSET.quality(), f: FIGHTSET.fps() })")
        ok(d["q"] == "high" and d["f"] == 0, f"your own choice comes back with saver off: {d}")
        await b.close()
    ok(not errs, f"page errors: {errs[:3]}")
    for f in fails: print("FAIL", f)
    print("RESULT OK" if not fails else f"{len(fails)} FAILED")

asyncio.run(main())
