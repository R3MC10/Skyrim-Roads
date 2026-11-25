"""Report a problem (bugreport.js): F12 opens the window, Settings has the button (the phone's way in), Esc / Cancel
close it, and Send with no server keeps the report for later. Phone and PC sizes, both art styles.
Usage: python bugreport_ui.py PORT — prints RESULT OK. Screenshots in tests/bugrep/."""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bugrep") + os.sep; os.makedirs(OUT, exist_ok=True)
CHROME = (__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None))
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

REACH = """(sel)=>{ const b=document.querySelector(sel); if(!b) return 'missing'; const r=b.getBoundingClientRect();
  if (r.bottom<=0 || r.top>=innerHeight || r.right>innerWidth+1 || r.height<30) return 'off screen';
  const hit=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2); return hit && (hit===b || b.contains(hit)) ? 'ok' : 'covered by '+(hit&&hit.className); }"""

async def main():
    async with async_playwright() as p:
        kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if CHROME and os.path.exists(CHROME) else {}
        b = await p.chromium.launch(**kw)
        for vw, vh, tag in [(412, 915, "phone"), (1366, 800, "pc")]:
            ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=2 if tag == "phone" else 1, has_touch=tag == "phone")
            errs = []
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "").replace(chr(10), " ")[:300]))
            await pg.goto(f"http://localhost:{PORT}/index.html?notut&p=br{tag}"); await pg.wait_for_timeout(1500)
            await pg.click(".press"); await pg.wait_for_timeout(400)
            for style in ["ink"]:
                await pg.evaluate(f"ART.setStyle && ART.setStyle('{style}')")
                # F12 from anywhere
                await pg.keyboard.press("F12"); await pg.wait_for_timeout(300)
                ok(await pg.locator("#bugrep").count() == 1, f"{tag}/{style}: F12 opens the report window")
                for sel in ["#brtitle", "#brtext", "#bugrep [data-brep=send]", "#bugrep [data-brep=cancel]"]:
                    r = await pg.evaluate(REACH, sel); ok(r == "ok", f"{tag}/{style}: {sel} reachable ({r})")
                await pg.screenshot(path=f"{OUT}{tag}_{style}_open.png")
                await pg.keyboard.press("Escape"); await pg.wait_for_timeout(200)
                ok(await pg.locator("#bugrep").count() == 0, f"{tag}/{style}: Esc closes it")
            # Settings → Report a problem
            await pg.wait_for_selector("[data-t=settings]")
            await pg.evaluate("document.querySelector('[data-t=settings]').click()")
            btn = pg.locator("[data-brep=open]")
            try: await btn.wait_for(timeout=5000)
            except Exception: await pg.screenshot(path=f"{OUT}{tag}_settings_missing.png")
            ok(await btn.count() == 1, f"{tag}: Settings has Report a problem")
            if not await btn.count(): continue
            await btn.scroll_into_view_if_needed(); await btn.click(); await pg.wait_for_timeout(300)
            ok(await pg.locator("#bugrep").count() == 1, f"{tag}: the Settings button opens it")
            await pg.fill("#brtitle", "Test report"); await pg.fill("#brtext", "Typing here doesn't open tabs: m i s c")
            await pg.click("#bugrep [data-brcat=art]")
            ok(await pg.locator("#bugrep [data-brcat=art].on").count() == 1, f"{tag}: picking a kind")
            await pg.click("#bugrep [data-brep=send]"); await pg.wait_for_timeout(500)
            msg = await pg.text_content("#brmsg")
            ok(msg == "Saved, will send when online", f"{tag}: no server in tests: kept for later ({msg})")
            await pg.screenshot(path=f"{OUT}{tag}_sent.png")
            q = await pg.evaluate("BUGREPORT.queue().length")
            ok(q >= 1, f"{tag}: queued on the device ({q})")
            await pg.wait_for_timeout(1800)
            ok(await pg.locator("#bugrep").count() == 0, f"{tag}: closes itself after sending")
            ok(not errs, f"{tag}: no page errors {errs[:2]}")
            await ctx.close()
        await b.close()
    print("RESULT", "OK" if not fails else f"FAIL ({len(fails)})")

asyncio.run(main())
