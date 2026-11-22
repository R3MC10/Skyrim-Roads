"""Patch notes: open from the title menu, from title Settings and from in-game Settings; the What's new popup shows once.
usage: python3 test_notes_ui.py [port]   (prints RESULT OK)"""
import asyncio, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
BASE = f"http://localhost:{PORT}/index.html?net=bc&notut&whatsnew"

async def closeall(pg):
    for _ in range(6):
        b = await pg.query_selector("#modal [data-act=close]")
        if not b: break
        await b.click(); await pg.wait_for_timeout(250)

async def run(p, style):
    b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2)
    errs, ok = [], True
    pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.set_default_timeout(60000)
    await pg.goto(BASE + f"&p=pn{style}"); await pg.wait_for_timeout(2500)
    await pg.evaluate(f"()=>{{try{{const p=JSON.parse(localStorage.getItem('rotn_prefs')||'{{}}');p.artStyle='{style}';localStorage.setItem('rotn_prefs',JSON.stringify(p))}}catch(e){{}}}}")
    # 1. new character: no popup, notes marked seen
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Noto"); await pg.click("#begin")
    await pg.wait_for_timeout(3500)
    pop = await pg.query_selector("#modal .pnwhat")
    print(style, "new char popup:", bool(pop)); ok &= not pop
    # 2. pretend an older version was last seen -> reload -> Continue -> popup once
    await pg.evaluate("()=>{Store.save(window.__dbg.save()); localStorage.setItem(PATCHNOTES.KEY,'old')}")
    await pg.reload(); await pg.wait_for_timeout(2500)
    await pg.click(".press"); await pg.wait_for_timeout(400)
    badge = await pg.evaluate("document.querySelector('.mi[data-t=notes] .badge')?.textContent||''")
    print(style, "menu badge:", badge); ok &= badge == "New"
    await pg.screenshot(path=f"notes_menu_{style}.png")
    await pg.click(".mi[data-t=continue]")
    await pg.wait_for_selector("#modal .pnwhat", timeout=20000)
    await pg.wait_for_timeout(500)
    await pg.screenshot(path=f"notes_whatsnew_{style}.png")
    t = await pg.evaluate("document.querySelector('#modal .pnwhat h2').textContent")
    print(style, "whats new:", t); ok &= t == await pg.evaluate("PATCHNOTES.latest().title")
    # "All patch notes" from the popup
    await pg.click("#modal [data-act=notes]"); await pg.wait_for_timeout(400)
    n = await pg.evaluate("document.querySelectorAll('#modal .pnotes details').length")
    print(style, "entries in modal:", n); ok &= n == await pg.evaluate("PATCHNOTES.LIST.length+1")
    await pg.screenshot(path=f"notes_modal_{style}.png")
    await closeall(pg)
    # reload: popup must NOT come back
    await pg.reload(); await pg.wait_for_timeout(2500)
    await pg.click(".press"); await pg.wait_for_timeout(300)
    badge2 = await pg.evaluate("document.querySelector('.mi[data-t=notes] .badge')?.textContent||''")
    await pg.click(".mi[data-t=continue]"); await pg.wait_for_timeout(4500)
    pop2 = await pg.query_selector("#modal .pnwhat")
    print(style, "second time popup:", bool(pop2), "badge:", repr(badge2)); ok &= not pop2 and badge2 == ""
    await closeall(pg)
    # 3. in-game Settings -> Patch notes
    await pg.click("#sndBtn"); await pg.wait_for_timeout(400)
    await pg.click("#modal [data-act=notes]"); await pg.wait_for_timeout(400)
    n2 = await pg.evaluate("document.querySelectorAll('#modal .pnotes details').length")
    print(style, "from settings:", n2); ok &= n2 > 5
    await closeall(pg)
    # 4. title menu item and title Settings button
    await pg.evaluate("()=>{Store.save(window.__dbg.save())}")
    await pg.reload(); await pg.wait_for_timeout(2500)
    await pg.click(".press"); await pg.click(".mi[data-t=notes]"); await pg.wait_for_timeout(500)
    n3 = await pg.evaluate("document.querySelectorAll('#title .pnotes details').length")
    await pg.screenshot(path=f"notes_title_{style}.png")
    await pg.click("#title .page [data-t=menu]"); await pg.click(".mi[data-t=settings]"); await pg.wait_for_timeout(300)
    await pg.click("#title .page [data-t=notes]"); await pg.wait_for_timeout(400)
    n4 = await pg.evaluate("document.querySelectorAll('#title .pnotes details').length")
    print(style, "title menu:", n3, "title settings:", n4); ok &= n3 > 5 and n4 > 5
    print(style, "errors:", errs); ok &= not errs
    await b.close()
    return ok

async def main():
    async with async_playwright() as p:
        ok = True
        for st in ("ink", "pixel"):
            ok &= await run(p, st)
        print("RESULT", "OK" if ok else "FAIL")
asyncio.run(main())
