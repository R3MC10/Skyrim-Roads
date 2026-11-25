import asyncio, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8833"

async def run(b, style, reduce=False, plain=False):
    ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2, reduced_motion="reduce" if reduce else "no-preference")
    await ctx.add_init_script(f"try{{const p=JSON.parse(localStorage.getItem('rotn_prefs')||'{{}}');p.artStyle='{style}';localStorage.setItem('rotn_prefs',JSON.stringify(p))}}catch(e){{}}")
    await ctx.add_init_script("""window.__seen=new Set();document.addEventListener('DOMContentLoaded',()=>{new MutationObserver(rs=>{for(const r of rs)for(const n of r.addedNodes)if(n.nodeType===1&&n.className&&typeof n.className==='string')n.className.split(/\\s+/).forEach(c=>c.startsWith('mo-')&&window.__seen.add(c))}).observe(document.body,{childList:true})})""")
    errs = []
    pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    q = "" if plain else "&motion"
    await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=mo{style[0]}{int(reduce)}{q}"); await pg.wait_for_timeout(2200)
    tag = f"{style}{'_rm' if reduce else ''}{'_plain' if plain else ''}"
    res = {}
    res["on"] = await pg.evaluate("document.documentElement.classList.contains('mo-on')")
    res["amb"] = await pg.evaluate("!!document.querySelector('#title .mo-amb')")
    if not reduce and not plain: await pg.screenshot(path=f"mo_title_{tag}.png")
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Motus"); await pg.click("#begin"); await pg.wait_for_timeout(1400)
    async def shut():
        for _ in range(6):
            m = await pg.query_selector("#modal:not(.mo-ghost) [data-act=close]")
            if not m: break
            await m.click(); await pg.wait_for_timeout(250)
    await shut()
    res["xpbar"] = await pg.evaluate("!!document.querySelector('#moxp')")
    res["uline"] = await pg.evaluate("!!document.querySelector('#tabs .mo-uline')")
    # gold count-up
    await pg.evaluate("()=>{window.__dbg.save().gold += 250; window.__dbg.toast('Sold a thing')}")
    await pg.wait_for_timeout(120)
    mid = await pg.evaluate("document.querySelector('#goldv').textContent")
    await pg.wait_for_timeout(1200)
    res["gold_1200"] = await pg.evaluate("document.querySelector('#goldv').textContent")
    await pg.wait_for_timeout(2500)
    end = await pg.evaluate("document.querySelector('#goldv').textContent")
    g = await pg.evaluate("window.__dbg.save().gold")
    res["gold_mid"] = mid; res["gold_end"] = end
    assert end == f"{g} gold", (end, g)
    # modal pop + ghost on close
    await pg.evaluate("window.__dbg.message('A test', 'Some words.')")
    await pg.wait_for_timeout(60)
    res["modal_pop"] = await pg.evaluate("document.querySelector('#modal')?.classList.contains('mo-pop')")
    if not reduce and not plain: await pg.screenshot(path=f"mo_modal_{tag}.png")
    await pg.click("#modal [data-act=close]"); await pg.wait_for_timeout(40)
    res["ghost"] = await pg.evaluate("window.__seen.has('mo-ghost')")
    await pg.wait_for_timeout(1500)
    res["ghost_gone"] = await pg.evaluate("!document.querySelector('.mo-ghost')")
    # menu enter + page slide
    res["menu_enter"] = await pg.evaluate("(()=>{document.querySelector('#tabs [data-tab=pack]').click(); return !!document.querySelector('#sky')?.classList.contains('mo-enter')})()")
    await pg.wait_for_timeout(150)
    if not reduce and not plain: await pg.screenshot(path=f"mo_menu_{tag}.png")
    res["page_slide"] = await pg.evaluate("(()=>{document.querySelector('[data-act=skytab][data-id=magic]').click(); return [...document.querySelectorAll('#sky .mo-page-r, #sky .mo-page-l')].length})()")
    await pg.wait_for_timeout(500)
    await pg.click('[data-act=skyclose]'); await pg.wait_for_timeout(500)
    # tab switch stagger
    res["stagger"] = await pg.evaluate("(()=>{document.querySelector('#tabs [data-tab=log]').click(); return document.querySelectorAll('#side .mo-st').length})()")
    await pg.wait_for_timeout(800)
    # level up constellation
    await pg.evaluate("()=>MOTION.celebrate()")
    await pg.wait_for_timeout(700)
    res["const"] = await pg.evaluate("window.__seen.has('mo-const')")
    if not reduce and not plain: await pg.screenshot(path=f"mo_level_{tag}.png")
    # arrival veil
    await pg.evaluate("()=>{const S=window.__dbg.save(); S.location='Whiterun';}")
    await pg.wait_for_timeout(1500)
    res["veil"] = await pg.evaluate("window.__seen.has('mo-veil')")
    if not reduce and not plain: await pg.screenshot(path=f"mo_veil_{tag}.png")
    # settings toggle
    await pg.evaluate("()=>MOTION.setPref('off')")
    res["off"] = await pg.evaluate("!document.documentElement.classList.contains('mo-on')")
    await pg.evaluate("()=>MOTION.setPref('full')")
    res["errs"] = errs
    print(tag, res)
    await ctx.close()
    return res

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        for st in ("ink",):
            r = await run(b, st)
            assert r["on"] and r["amb"] and r["xpbar"] and r["uline"] and r["modal_pop"] and r["ghost"] and r["ghost_gone"], r
            assert r["menu_enter"] and r["page_slide"] and r["stagger"] > 0 and r["const"] and r["veil"] and r["off"], r
            assert r["gold_mid"] != r["gold_end"], r
            assert not r["errs"], r["errs"]
        r = await run(b, "ink", reduce=True)
        assert not r["on"] and not r["amb"] and not r["modal_pop"] and not r["ghost"] and not r["menu_enter"] and not r["const"] and not r["veil"] and r["stagger"] == 0, r
        assert r["gold_1200"] == r["gold_end"] and not r["errs"], r
        r = await run(b, "ink", plain=True)   # automation without ?motion: everything still, existing tests unaffected
        assert not r["on"] and not r["modal_pop"] and not r["ghost"] and not r["errs"], r
        print("RESULT OK")
        await b.close()
asyncio.run(main())
