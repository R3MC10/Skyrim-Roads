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
    # "What would the AI do?" (aitester.js): under Smart AI the rules fold into one row and the tester shows a pick
    t0 = await pg.evaluate("""()=>({fold: !!document.querySelector('#side .rulesfold'), open: !!document.querySelector('#side .rulesfold[open]'),
      card: !!document.querySelector('#aitcard'), pick: document.querySelector('#aitout .aitpick b')?.textContent || '', rows: document.querySelectorAll('#aitout .aitrule').length})""")
    ok(t0["fold"] and not t0["open"], f"{name}: Smart AI folds your rules into one closed row")
    ok(t0["card"] and t0["pick"] and t0["rows"] == 0, f"{name}: tester shows Smart AI's move ({t0['pick']}) without rule rows")
    await pg.locator("#aitcard").scroll_into_view_if_needed(); await pg.wait_for_timeout(200)
    await pg.locator("#aitcard").screenshot(path=_SHOTS + f"aitester_smart_{name}.png")
    await pg.click("#side .rulesfold > summary"); await pg.wait_for_timeout(300)
    ok(await pg.evaluate("!!document.querySelector('#side .rulesfold[open] .rlist')"), f"{name}: tapping the row unfolds the rules")
    # switching loadouts still works from here
    if st["lo"] >= 1:
        await pg.locator("#side .lochip").first.click(); await pg.wait_for_timeout(300)
    await pg.locator("#side .aimode button").last.click(); await pg.wait_for_timeout(300)
    ok(await pg.evaluate("G.loadout(window.__dbg.save()).mode") == "custom", f"{name}: AI mode switch works")
    # Custom: the tester walks the rules; moving the health slider below 50 switches the ticked rule
    await pg.evaluate("()=>{const L=G.loadout(window.__dbg.save()); L.rules=[{if:'hp_below',pct:50,do:'block'},{if:'enemy_hp_below',pct:30,do:'power_attack'},{if:'always',do:'attack'}]; AITEST.reset(); window.__ui.go('tactics')}")
    await pg.wait_for_timeout(500)
    fired = "()=>[...document.querySelectorAll('#aitout .aitrule')].findIndex(r=>r.classList.contains('fire'))+1"
    ok(await pg.evaluate("document.querySelectorAll('#aitout .aitrule').length") == 3, f"{name}: three rule rows in the tester")
    ok(await pg.evaluate(fired) == 3, f"{name}: at full health rule 3 (Always) fires")
    why1 = await pg.evaluate("document.querySelector('#aitout .aitrule small')?.textContent || ''")
    ok("health is 100%, rule needs below 50%" in why1, f"{name}: rule 1 says why it was skipped ({why1})")
    await pg.locator("#aitcard .aitslide[data-k=hp]").fill("30"); await pg.wait_for_timeout(400)
    ok(await pg.evaluate(fired) == 1, f"{name}: health 30% -> rule 1 fires")
    ok(await pg.evaluate("document.querySelector('#aitcard [data-v=hp]').textContent") == "30%", f"{name}: slider value shown")
    ok(await pg.evaluate("document.querySelector('#aitout .aitpick').dataset.action") == "block", f"{name}: the pick is the rule's move")
    await pg.click("#aitcard [data-ait=foe][data-v=dragon]"); await pg.wait_for_timeout(300)
    ok("ragon" in await pg.evaluate("document.querySelector('#aitout .aitpick small').textContent"), f"{name}: foe chip switches the foe")
    st2 = await pg.evaluate("({sw: document.documentElement.scrollWidth, iw: innerWidth})")
    ok(st2["sw"] <= st2["iw"] + 1, f"{name}: tester fits without sideways scroll")
    await pg.locator("#aitcard").scroll_into_view_if_needed(); await pg.wait_for_timeout(200)
    await pg.locator("#aitcard").screenshot(path=_SHOTS + f"aitester_custom_{name}.png")
    ok(await pg.evaluate("I18N.PL['What would the AI do?']") == "Co zrobi SI?", f"{name}: tester in Polish")
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
