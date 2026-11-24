"""Patch notes: the Back / close button stays reachable while the list scrolls. Usage: python patchnotes_ui.py PORT — prints RESULT OK.
Title menu → Patch Notes (‹ Back pinned at the top) and the in-game popup (✕ pinned at the top), scrolled to the
middle and to the end, in both art styles; the button is on screen, tappable (not covered) and does its job.
Screenshots in tests/pnotes/."""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8901"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pnotes") + os.sep; os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

# is this button inside the viewport and the topmost thing at its centre (so a tap reaches it)?
REACH = """(sel)=>{ const b=document.querySelector(sel); if(!b) return 'missing'; const r=b.getBoundingClientRect();
  if (r.bottom<=0 || r.top>=innerHeight || r.height<30) return 'off screen '+Math.round(r.top);
  const hit=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2); return hit && (hit===b || b.contains(hit)) ? 'ok' : 'covered by '+(hit&&hit.className); }"""

async def main():
    async with async_playwright() as p:
        kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if os.path.exists(CHROME) else {}
        b = await p.chromium.launch(**kw)
        ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2, has_touch=True)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=pn1"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.wait_for_timeout(400)
        for style in ["ink", "pixel"]:
            await pg.evaluate(f"ART.setStyle('{style}')")
            # ---- title menu page
            await pg.click(".mi[data-t=notes]"); await pg.wait_for_timeout(500)
            ok(await pg.evaluate("!!document.querySelector('#tinner .pnbar .pnback')"), f"{style} title: Back sits in a header bar")
            sh = await pg.evaluate("document.querySelector('#tinner').scrollHeight - document.querySelector('#tinner').clientHeight")
            ok(sh > 2000, f"{style} title: the list is long enough to scroll ({sh}px)")
            for where, frac in [("top", 0), ("middle", 0.5), ("end", 1)]:
                await pg.evaluate(f"(()=>{{const t=document.querySelector('#tinner'); t.scrollTop=(t.scrollHeight-t.clientHeight)*{frac};}})()"); await pg.wait_for_timeout(250)
                r = await pg.evaluate(REACH, "#tinner .pnbar .pnback")
                ok(r == "ok", f"{style} title, scrolled to the {where}: ‹ Back is on screen and tappable ({r})")
                if where == "middle": await pg.screenshot(path=OUT + f"{style}_title_middle.png")
            await pg.click("#tinner .pnbar .pnback"); await pg.wait_for_timeout(400)
            ok(await pg.evaluate("!!document.querySelector('.mi[data-t=notes]') && !document.querySelector('#tinner .pnbar')"), f"{style} title: ‹ Back returns to the menu")
        # ---- in-game popup
        await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Reader"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        for style in ["ink", "pixel"]:
            await pg.evaluate(f"ART.setStyle('{style}')")
            # the same path as the in-game "\ue103 Patch notes" buttons: a data-act="notes" button inside a panel
            await pg.evaluate("(()=>{ __dbg.message('Notes','x'); const m=document.querySelector('#modal'); const b=document.createElement('button'); b.dataset.act='notes'; m.querySelector('.sheet').appendChild(b); b.click(); })()")
            await pg.wait_for_timeout(500)
            ok(await pg.evaluate("!!document.querySelector('#modal .pnsheet .pnbar .pnx')"), f"{style} popup: ✕ sits in a header bar")
            for where, frac in [("middle", 0.5), ("end", 1)]:
                await pg.evaluate(f"(()=>{{const t=document.querySelector('#modal .sheet'); t.scrollTop=(t.scrollHeight-t.clientHeight)*{frac};}})()"); await pg.wait_for_timeout(250)
                r = await pg.evaluate(REACH, "#modal .pnbar .pnx")
                ok(r == "ok", f"{style} popup, scrolled to the {where}: ✕ is on screen and tappable ({r})")
                if where == "middle": await pg.screenshot(path=OUT + f"{style}_popup_middle.png")
            await pg.click("#modal .pnbar .pnx"); await pg.wait_for_timeout(300)
            ok(not await pg.evaluate("!!document.querySelector('#modal')"), f"{style} popup: ✕ closes it")
        ok(not errs, f"no page errors {errs[:3]}")
        await b.close()
    print("RESULT OK" if not fails else f"RESULT FAIL ({len(fails)})")

asyncio.run(main())
