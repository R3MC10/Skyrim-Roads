"""Tab compass on a PC keyboard (tabmenu.js + desktop.js): Tab opens/closes it, W A S D / arrows open the four menus,
Enter opens the leaning one, Esc closes, 1-5 press the bottom buttons, key badges only show with a mouse.
Usage: python3 tabkeys_ui.py PORT   (screenshots go to $OUT or tests/out_tabkeys/)"""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.environ.get("OUT") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_tabkeys")
os.makedirs(OUT, exist_ok=True)
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)
async def main():
    async with async_playwright() as p:
        exe = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
        b = await (p.chromium.launch(executable_path=exe, args=["--no-sandbox"]) if exe else p.chromium.launch(args=["--no-sandbox"]))
        ctx = await b.new_context(viewport={"width": 1280, "height": 800})
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&hub=0&assets&p=tk1"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Sigrid"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        clear = "document.querySelectorAll('#modal').forEach(m=>m.remove())"
        await pg.evaluate("""()=>{const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.discovered.push('Whiterun');}""")
        await pg.evaluate("setInterval(()=>document.querySelectorAll('#modal').forEach(m=>m.remove()),200)")
        await pg.evaluate(clear); await pg.evaluate("document.activeElement?.blur?.()")
        st = lambda: pg.evaluate("({hub:!!document.querySelector('#tw'), sky:document.querySelector('#sky .sky-page.on')?.dataset.id||null, char:TABMENU.charMode, tab:__ui.tab})")
        async def tab_open():
            if not (await st())["hub"]:
                await pg.evaluate("document.activeElement?.blur?.()"); await pg.keyboard.press("Tab"); await pg.wait_for_timeout(500)
        ok(not (await st())["hub"], "compass starts closed")
        await pg.keyboard.press("Tab"); await pg.wait_for_timeout(600); s = await st(); ok(s["hub"], f"Tab opens the compass {s}")
        vis = await pg.evaluate("""()=>({k:getComputedStyle(document.querySelector('#tw .tw-up .tw-k')).display, keys:getComputedStyle(document.querySelector('#tw .tw-keys')).display,
            touch:getComputedStyle(document.querySelector('#tw .tw-touch')).display, w:document.querySelector('#tw .tw-up .tw-k').textContent})""")
        ok(vis["k"] != "none" and vis["w"] == "W" and vis["keys"] != "none" and vis["touch"] == "none", f"PC shows key badges and the WASD hint {vis}")
        await pg.screenshot(path=os.path.join(OUT, "hub_keys.png"))
        # hold W: the compass leans up, then opens Skills when let go
        await pg.keyboard.down("w"); await pg.wait_for_timeout(250)
        g = await pg.evaluate("document.querySelector('#tw')?.dataset.glow"); ok(g == "up", f"holding W leans the compass up ({g})")
        await pg.screenshot(path=os.path.join(OUT, "hub_lean_w.png"))
        await pg.keyboard.up("w"); await pg.wait_for_timeout(500); s = await st(); ok(s["char"] and not s["hub"], f"W opens Skills {s}")
        await pg.keyboard.press("Tab"); await pg.wait_for_timeout(500); s = await st(); ok(s["hub"] and not s["char"], f"Tab from Skills goes back to the compass {s}")
        await pg.keyboard.press("Tab"); await pg.wait_for_timeout(400); s = await st(); ok(not s["hub"], f"Tab closes the compass {s}")
        await tab_open(); await pg.keyboard.press("a"); await pg.wait_for_timeout(500); s = await st(); ok(s["sky"] == "magic", f"A opens Magic {s}")
        await pg.screenshot(path=os.path.join(OUT, "magic.png"))
        await tab_open(); await pg.keyboard.press("d"); await pg.wait_for_timeout(500); s = await st(); ok(s["sky"] == "items", f"D opens Items {s}")
        await tab_open(); await pg.keyboard.press("s"); await pg.wait_for_timeout(500); s = await st(); ok(not s["hub"] and s["tab"] == "map" and not s["sky"], f"S opens the Map {s}")
        await tab_open(); await pg.keyboard.press("ArrowLeft"); await pg.wait_for_timeout(500); s = await st(); ok(s["sky"] == "magic", f"ArrowLeft opens Magic {s}")
        # Enter opens the leaning direction (key still held)
        await tab_open(); await pg.keyboard.down("ArrowRight"); await pg.wait_for_timeout(200); await pg.keyboard.press("Enter"); await pg.wait_for_timeout(400)
        s = await st(); ok(s["sky"] == "items", f"Enter opens the leaning direction {s}"); await pg.keyboard.up("ArrowRight")
        # Esc closes the compass
        await tab_open(); s = await st(); ok(s["hub"], "compass open again")
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(300); s = await st(); ok(not s["hub"], f"Esc closes the compass {s}")
        # number keys press the bottom row
        await tab_open()
        order = await pg.evaluate("[...document.querySelectorAll('#tw .tw-q')].map(b=>b.dataset.twq)"); print("bottom row", order)
        n = order.index("log") + 1
        await pg.keyboard.press(str(n)); await pg.wait_for_timeout(400); s = await st(); ok(s["tab"] == "log" and not s["hub"], f"{n} opens the Journal {s}")
        # Tab is left alone while typing
        await pg.evaluate("""()=>{const i=document.createElement('input'); i.id='tkin'; document.body.appendChild(i); i.focus();}""")
        await pg.keyboard.press("Tab"); await pg.wait_for_timeout(300); s = await st(); ok(not s["hub"], f"Tab while typing doesn't open the compass {s}")
        await pg.evaluate("document.getElementById('tkin').remove()")
        # a minigame has the keys
        await pg.evaluate("""()=>{const d=document.createElement('div'); d.id='lockpick'; d.className='lockpick'; document.body.appendChild(d); document.activeElement?.blur?.();}""")
        await pg.keyboard.press("Tab"); await pg.wait_for_timeout(300); s = await st(); ok(not s["hub"], f"Tab in a minigame doesn't open the compass {s}")
        await pg.evaluate("document.getElementById('lockpick').remove()")
        # touch phone: no badges, swipe text
        ctx2 = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2, has_touch=True, is_mobile=True)
        pg2 = await ctx2.new_page()
        await pg2.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&hub=1&assets&p=tk2"); await pg2.wait_for_timeout(1500)
        await pg2.click(".press"); await pg2.click(".mi[data-t=new]"); await pg2.fill("#nm", "Sigrid"); await pg2.click("#begin"); await pg2.wait_for_timeout(1500)
        await pg2.evaluate(clear); await pg2.evaluate("TABMENU.closeHub(); TABMENU.openHub()"); await pg2.wait_for_timeout(600); await pg2.evaluate(clear)
        vis = await pg2.evaluate("""()=>({k:getComputedStyle(document.querySelector('#tw .tw-up .tw-k')).display, keys:getComputedStyle(document.querySelector('#tw .tw-keys')).display,
            touch:getComputedStyle(document.querySelector('#tw .tw-touch')).display})""")
        ok(vis["k"] == "none" and vis["keys"] == "none" and vis["touch"] != "none", f"phone hides key badges {vis}")
        await pg2.screenshot(path=os.path.join(OUT, "hub_phone.png"))
        ok(not errs, f"no page errors {errs[:3]}")
        await b.close()
    print("RESULT", "OK" if not fails else f"FAIL {len(fails)}")
    print("screenshots:", OUT)
asyncio.run(main())
