"""The loadouts / AI rules screen can be reached again: compass -> Skills -> "AI & Loadouts" tab, and the Character tab's
sub-tab row. Checks the screen draws (AI mode switch, rules, loadouts), fits a phone (390 px) and a PC without
sideways scrolling, the back button returns to the compass, and the Polish label exists.
Usage: python tacticsaccess_ui.py PORT   (serve the game with: node serve.js PORT)"""
import asyncio, os, sys, tempfile
from playwright.async_api import async_playwright
_SHOTS = (os.environ.get("SHOTS") or os.path.join(tempfile.gettempdir(), "rotn_shots")).replace("\\", "/").rstrip("/") + "/"
os.makedirs(_SHOTS, exist_ok=True)
PORT = sys.argv[1] if len(sys.argv) > 1 else "8780"
CLEAR = "document.querySelectorAll('#modal,#sky').forEach(m=>m.remove())"
fails = []
def ok(c, msg):
    print(("ok   " if c else "FAIL ") + msg)
    if not c: fails.append(msg)

async def run(b, name, vw, vh):
    ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=2 if vw < 600 else 1)
    errs = []
    pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(f"http://127.0.0.1:{PORT}/index.html?net=bc&notut"); await pg.wait_for_timeout(1500)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Tess"); await pg.click("#begin"); await pg.wait_for_timeout(2500)
    await pg.evaluate(CLEAR)
    # 1. compass -> Skills -> AI & Loadouts
    await pg.evaluate("TABMENU.openHub()"); await pg.wait_for_timeout(400)
    await pg.click("#tw [data-twgo=char]"); await pg.wait_for_timeout(500)
    await pg.evaluate(CLEAR)
    tab = pg.locator("#twbar [data-twb=tactics]")
    ok(await tab.count() == 1, f"{name}: AI & Loadouts tab on the Skills page bar")
    ok((await tab.text_content()).strip() == "AI & Loadouts", f"{name}: tab label")
    await tab.scroll_into_view_if_needed(); await tab.click(); await pg.wait_for_timeout(500)
    st = await pg.evaluate("""()=>({tab: window.__ui.tab, aimode: !!document.querySelector('#side .aimode'), rules: !!document.querySelector('#side .rulesbox'),
      lo: document.querySelectorAll('#side .lochip').length, head: document.querySelector('#side .uxh-t b')?.textContent,
      on: document.querySelector('#twbar .twbar-t.on')?.dataset.twb, charMode: document.body.classList.contains('tw-char'),
      sw: document.documentElement.scrollWidth, iw: innerWidth, back: !!document.querySelector('#twbar [data-twb=hub]')})""")
    ok(st["tab"] == "tactics", f"{name}: tactics screen open ({st['tab']})")
    ok(st["aimode"] and st["rules"] and st["lo"] >= 1, f"{name}: AI mode switch, rules and loadouts drawn")
    ok(st["head"] == "AI & Loadouts", f"{name}: screen header ({st['head']})")
    ok(st["on"] == "tactics" and st["charMode"], f"{name}: stays on the Skills page with the tab lit")
    ok(st["sw"] <= st["iw"] + 1, f"{name}: no sideways scroll ({st['sw']} <= {st['iw']})")
    ok(st["back"], f"{name}: back button")
    await pg.evaluate("window.scrollTo(0,0)")
    await pg.screenshot(path=_SHOTS + f"tacticsaccess_{name}.png")
    # switching loadouts still works from here
    if st["lo"] >= 1:
        await pg.locator("#side .lochip").first.click(); await pg.wait_for_timeout(300)
    await pg.locator("#side .aimode button").last.click(); await pg.wait_for_timeout(300)
    ok(await pg.evaluate("G.loadout(window.__dbg.save()).mode") == "custom", f"{name}: AI mode switch works")
    # 2. the back button goes to the compass
    await pg.click("#twbar [data-twb=hub]"); await pg.wait_for_timeout(400)
    ok(await pg.evaluate("!!document.querySelector('#tw')"), f"{name}: back returns to the compass")
    await pg.evaluate("TABMENU.closeHub()")
    # 3. the Character tab's sub-tab row has it too
    await pg.evaluate("window.__ui.go('hero')"); await pg.wait_for_timeout(400)
    sub = await pg.evaluate("!!document.querySelector('#side [data-act=tabgo][data-id=tactics]') || !!document.querySelector('#twbar [data-twb=tactics]')")
    ok(sub, f"{name}: Character sub-tab row lists AI & Loadouts")
    ok(await pg.evaluate("I18N.PL['AI & Loadouts']") == "SI i zestawy", f"{name}: Polish label")
    ok(not errs, f"{name}: no page errors {errs[:3]}")
    await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        await run(b, "phone", 390, 844)
        await run(b, "pc", 1366, 800)
        await b.close()
    print("RESULT", "OK" if not fails else "FAIL " + "; ".join(fails))
asyncio.run(main())
