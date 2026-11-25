"""Gathering with real taps and clicks (not JS .click()): the Gather and Forage buttons must give ingredients
on a phone (side panel card) and on a PC (the map is the home screen there and the side panel is hidden, so the card
floats over the map). Also an old save whose gathering record lacks fields.
    python3 gatherfix_ui.py 8765 [shots_dir]"""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_gatherfix")
CHROME = (__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None))
CNT = "()=>window.__dbg.save().inv.filter(r=>D.ITEMS[r.item]&&D.ITEMS[r.item].slot==='ingredient').reduce((a,r)=>a+r.qty,0)"

async def run(b, w, h, phone, bad, old=False):
    tag = f"[{'phone' if phone else 'pc'} {w}x{h}{' old save' if old else ''}]"
    ok = lambda c, m: (print(("ok   " if c else "FAIL ") + tag + " " + m), None if c else bad.append(tag + " " + m))
    ctx = await b.new_context(viewport={"width": w, "height": h}, has_touch=phone, is_mobile=phone)
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    for _ in range(3):   # a busy local server sometimes drops a script: load again
        errs.clear(); await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=gfx{w}{int(old)}"); await pg.wait_for_timeout(1800)
        if not errs and await pg.evaluate("typeof GATHER!=='undefined'"): break
    await pg.click(".press"); await pg.wait_for_timeout(400); await pg.click(".mi[data-t=new]"); await pg.wait_for_selector("#nm"); await pg.fill("#nm", "Herba"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
    await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
    await pg.evaluate("""(old)=>{const S=window.__dbg.save(); const n=GATHER.nodes().find(n=>n.ing==='ing_juniper'); S.location=null; S.x=n.pos[0]; S.y=n.pos[1];
       if (old) S.gather={seen:{},picked:{}};
       for (const m of GATHER.around([S.x,S.y],120)) GATHER.st(S).seen[m.id]=1; if (old) delete S.gather.got;}""", old)
    await pg.evaluate("document.querySelector('[data-tab=log]')?.click()"); await pg.wait_for_timeout(300)
    await pg.evaluate("document.querySelector('[data-tab=town]')?.click()"); await pg.wait_for_timeout(1500)   # [gatherarea] Gathering lives in the Area tab
    await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
    root = "#side #au-gather"
    vis = await pg.evaluate(f"()=>{{const c=document.querySelector('{root}'); return !!c && c.getBoundingClientRect().height>0}}")
    ok(vis, "the Gathering card is on screen")
    os.makedirs(OUT, exist_ok=True)
    if vis and not old: await pg.screenshot(path=os.path.join(OUT, f"gatherfix_{'phone' if phone else 'pc'}.png"))
    for act in ("gpick", "gforage"):
        sel = f"{root} [data-act={act}]"
        if not await pg.query_selector(sel): ok(False, f"{act} button exists"); continue
        await pg.evaluate(f"document.querySelector('{sel}').scrollIntoView({{block:'center'}})"); await pg.wait_for_timeout(250)
        bb = await (await pg.query_selector(sel)).bounding_box()
        x, y = bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2
        top = await pg.evaluate(f"()=>{{const t=document.elementFromPoint({x},{y}); return !!t && !!t.closest('{sel}')}}")
        ok(top, f"nothing covers the {act} button")
        n0 = await pg.evaluate(CNT)
        if phone: await pg.touchscreen.tap(x, y)
        else: await pg.mouse.click(x, y)
        await pg.wait_for_timeout(600)
        if await pg.evaluate("!!document.querySelector('#hgame')"):   # Gather opens the hand-harvest mini-game (harvest_ui.py plays it)
            await pg.evaluate("HARVESTGAME._finish('good')"); await pg.wait_for_timeout(900)
            await pg.evaluate("document.querySelector('#hgame .hg-done')?.click()"); await pg.wait_for_timeout(300)
        n1 = await pg.evaluate(CNT)
        ok(n1 > n0 or (act == "gforage" and await pg.evaluate("window.__dbg.save().gather.forage>0")), f"{act} gives ingredients ({n0} -> {n1})")
    ok(not errs, f"no page errors {errs[:2]}")
    await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await (p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"]) if CHROME and os.path.exists(CHROME) else p.chromium.launch())
        bad = []
        await run(b, 390, 844, True, bad)
        await run(b, 1600, 900, False, bad)
        await run(b, 390, 844, True, bad, old=True)
        print("RESULT OK" if not bad else "RESULT FAIL " + "; ".join(bad))
        await b.close()
asyncio.run(main())
