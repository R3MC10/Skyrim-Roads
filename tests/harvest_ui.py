"""Hand harvesting with real taps and drags: the road prompt shows up near a ripe patch, Gather opens the mini-game,
tapping the ripe berries / swiping across a flower stem gives a grade and ingredients, the SkyUI result list shows,
Done closes it. Phone and PC, painted art on (?assets).
    python3 harvest_ui.py 8765 [shots_dir]"""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_harvest")
CHROME = "/usr/bin/google-chrome"
CNT = "(ing)=>window.__dbg.save().inv.filter(r=>r.item===ing).reduce((a,r)=>a+r.qty,0)"
GO = """(kind)=>{const S=window.__dbg.save(); const n=GATHER.nodes().find(n=>HARVEST.kindOf(n.ing)===kind && !(GATHER.st(S).picked||{})[n.id]);
  S.location=null; S.trip=null; S.x=n.pos[0]+0.01; S.y=n.pos[1]; for (const m of GATHER.around([S.x,S.y],120)) GATHER.st(S).seen[m.id]=1; return n.ing;}"""

async def canvas_pt(pg, x, y):
    r = await pg.evaluate("()=>{const r=document.querySelector('#hgame canvas').getBoundingClientRect(); return [r.left,r.top,r.width,r.height]}")
    return r[0] + x * r[2] / 320, r[1] + y * r[3] / 340

async def run(b, w, h, phone, bad):
    tag = f"[{'phone' if phone else 'pc'} {w}x{h}]"
    name = "phone" if phone else "pc"
    ok = lambda c, m: (print(("ok   " if c else "FAIL ") + tag + " " + m), None if c else bad.append(tag + " " + m))
    ctx = await b.new_context(viewport={"width": w, "height": h}, has_touch=phone, is_mobile=phone)
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    for _ in range(3):   # a busy local server sometimes drops a script: load again
        errs.clear(); await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&assets&p=hv{w}"); await pg.wait_for_timeout(2000)
        if not errs and await pg.evaluate("typeof HARVESTGAME!=='undefined' && typeof GATHER!=='undefined'"): break
    await pg.wait_for_selector(".press", timeout=60000); await pg.click(".press"); await pg.wait_for_timeout(500); await pg.click(".mi[data-t=new]"); await pg.wait_for_selector("#nm"); await pg.fill("#nm", "Herba"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
    await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
    os.makedirs(OUT, exist_ok=True)
    for kind in ("berry", "flower"):
        ing = await pg.evaluate(GO, kind)
        await pg.evaluate("document.querySelector('[data-tab=log]')?.click()"); await pg.wait_for_timeout(300)
        await pg.evaluate("document.querySelector('[data-tab=map]')?.click()"); await pg.wait_for_timeout(1800)
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        sel = "#gnear [data-act=gpick]"
        near = await pg.evaluate(f"()=>{{const c=document.querySelector('{sel}'); return !!c && c.getBoundingClientRect().height>0}}")
        ok(near, f"{kind}: the Gather prompt shows near the patch")
        if kind == "berry": await pg.screenshot(path=os.path.join(OUT, f"harvest_prompt_{name}.png"))
        if not near: continue
        bb = await (await pg.query_selector(sel)).bounding_box()
        x, y = bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2
        top = await pg.evaluate(f"()=>{{const t=document.elementFromPoint({x},{y}); return !t ? 'nothing' : t.closest('{sel}') ? '' : (t.id||'')+'.'+t.className+' '+t.outerHTML.slice(0,120)}}")
        ok(not top, f"{kind}: nothing covers the Gather prompt {top}")
        if top: await pg.screenshot(path=os.path.join(OUT, f"harvest_covered_{name}.png")); continue
        ing = await pg.evaluate(f"()=>GATHER.byId(document.querySelector('{sel}').dataset.id).ing")   # the nearest ripe patch
        n0 = await pg.evaluate(CNT, ing)
        if phone: await pg.touchscreen.tap(x, y)
        else: await pg.mouse.click(x, y)
        await pg.wait_for_timeout(500)
        ok(await pg.evaluate("!!document.querySelector('#hgame canvas')"), f"{kind}: the mini-game opens")
        await pg.screenshot(path=os.path.join(OUT, f"harvest_{kind}_play_{name}.png"))
        if kind == "berry":
            pts = await pg.evaluate("()=>HARVESTGAME.cur.ripe.map(b=>[b.x,b.y])")
            for bx, by in pts:
                cx, cy = await canvas_pt(pg, bx, by)
                await pg.mouse.move(cx, cy); await pg.mouse.down(); await pg.mouse.up(); await pg.wait_for_timeout(90)
        else:
            sx, cy = await pg.evaluate("()=>[HARVESTGAME.cur.stemX, HARVESTGAME.cur.cutY]")
            ax, ay = await canvas_pt(pg, sx - 70, cy); bx_, by_ = await canvas_pt(pg, sx + 70, cy)
            await pg.mouse.move(ax, ay); await pg.mouse.down()
            for i in range(1, 11): await pg.mouse.move(ax + (bx_ - ax) * i / 10, ay); await pg.wait_for_timeout(16)
            await pg.mouse.up()
        await pg.wait_for_timeout(1300)
        grade = await pg.evaluate("()=>document.querySelector('#hgame .hg-grade')?.textContent||''")
        ok(grade in ("Perfect harvest", "Good harvest"), f"{kind}: a clean pick grades well ({grade!r})")
        n1 = await pg.evaluate(CNT, ing)
        ok(n1 >= n0 + 2, f"{kind}: hand picking gives {n1 - n0} ({n0} -> {n1})")
        await pg.screenshot(path=os.path.join(OUT, f"harvest_{kind}_result_{name}.png"))
        done = await pg.query_selector("#hgame .hg-done")
        if done:
            db = await done.bounding_box()
            if phone: await pg.touchscreen.tap(db["x"] + db["width"] / 2, db["y"] + db["height"] / 2)
            else: await pg.mouse.click(db["x"] + db["width"] / 2, db["y"] + db["height"] / 2)
            await pg.wait_for_timeout(400)
        ok(not await pg.evaluate("!!document.querySelector('#hgame')"), f"{kind}: Done closes the mini-game")
    # the map markers: zoom in on the hero and take a picture
    await pg.evaluate("()=>{try{window.__ui?.refresh?.()}catch(e){}}"); await pg.wait_for_timeout(600)
    await pg.screenshot(path=os.path.join(OUT, f"harvest_map_{name}.png"))
    ok(not errs, f"no page errors {errs[:2]}")
    await ctx.close()

async def polish(b, w, h, phone, bad):
    """In Polish the Gathering card and the road prompt read in Polish (distance, weight, how to pick)."""
    tag = f"[pl {'phone' if phone else 'pc'}]"
    ok = lambda c, m: (print(("ok   " if c else "FAIL ") + tag + " " + m), None if c else bad.append(tag + " " + m))
    ctx = await b.new_context(viewport={"width": w, "height": h}, has_touch=phone, is_mobile=phone, locale="pl-PL")
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    for _ in range(3):
        errs.clear(); await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=hvpl{w}"); await pg.wait_for_timeout(2000)
        if not errs and await pg.evaluate("typeof HARVESTGAME!=='undefined' && typeof GATHER!=='undefined'"): break
    await pg.wait_for_selector(".press", timeout=60000); await pg.click(".press"); await pg.wait_for_timeout(500); await pg.click(".mi[data-t=new]"); await pg.wait_for_selector("#nm"); await pg.fill("#nm", "Herba"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
    await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
    await pg.evaluate(GO, "berry")
    await pg.evaluate("document.querySelector('[data-tab=log]')?.click()"); await pg.wait_for_timeout(300)
    await pg.evaluate("document.querySelector('[data-tab=map]')?.click()"); await pg.wait_for_timeout(1800)
    await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
    near = await pg.evaluate("()=>document.querySelector('#gnear')?.innerText||''")
    await pg.evaluate("document.querySelector('[data-tab=town]')?.click()"); await pg.wait_for_timeout(1200)   # [gatherarea] the card lives in the Area tab
    card = await pg.evaluate("()=>[...document.querySelectorAll('.gcard')].map(c=>c.innerText).join(' | ')")
    ok("kroków stąd" in card and "wagi za sztukę" in card, f"the Gathering card is in Polish ({card[:90]!r})")
    ok("paces away" not in card and "wt each" not in card, "no English distance or weight left on the card")
    ok("w zasięgu" in near and "gather" not in near.lower(), f"the road prompt is in Polish ({near[:60]!r})")
    await pg.screenshot(path=os.path.join(OUT, f"harvest_pl_{'phone' if phone else 'pc'}.png"))
    ok(not errs, f"no page errors {errs[:2]}")
    await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await (p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"]) if os.path.exists(CHROME) else p.chromium.launch())
        bad = []
        await run(b, 390, 844, True, bad)
        await run(b, 1600, 900, False, bad)
        await polish(b, 390, 844, True, bad)
        await polish(b, 1600, 900, False, bad)
        print("RESULT OK" if not bad else "RESULT FAIL " + "; ".join(bad))
        await b.close()
asyncio.run(main())
