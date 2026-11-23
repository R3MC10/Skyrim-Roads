"""Respec on the Character screen: shows up, asks first, then hands every perk and level-up choice back. Usage: python3 respec_ui.py PORT"""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tbf") + os.sep
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)
async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        exe = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
        b = await (p.chromium.launch(executable_path=exe, args=["--no-sandbox"]) if exe else p.chromium.launch(args=["--no-sandbox"]))
        ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2, has_touch=True)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=rs1"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Sigrid"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        clear = "document.querySelectorAll('#modal').forEach(m=>m.remove())"
        await pg.evaluate(clear)
        await pg.evaluate("""()=>{const S=window.__dbg.save(); S.gold=15000; S.level=6; S.pendingLevels=5; G.levelUp(S,'health'); G.levelUp(S,'stamina');
          for (const k in S.skills) S.skills[k].lvl=100; PERKS.take(S, Object.keys(PERKS.BY_ID).find(id=>!PERKS.BY_ID[id].needs.length)); }""")
        await pg.evaluate("""()=>{const b=document.querySelector('[data-act=tabgo][data-id=hero],[data-tab=hero],[data-act=uxtab][data-id=hero]'); b&&b.click();}""")
        await pg.wait_for_timeout(600); await pg.evaluate(clear)
        btn = pg.locator("[data-act=respec]").first
        if not await btn.count():   # some layouts render the Character page in a menu
            await pg.evaluate("()=>{ if (typeof MENUS!=='undefined' && MENUS.open) MENUS.open('hero'); }"); await pg.wait_for_timeout(600)
        ok(await btn.count() > 0, "respec button on the Character screen")
        await btn.scroll_into_view_if_needed(); await btn.click(); await pg.wait_for_timeout(400)
        ok(await pg.locator("[data-act=respecgo]").count() > 0, "asks to confirm")
        await pg.locator(".respec").first.screenshot(path=OUT + "respec_confirm.png")
        await pg.locator("[data-act=respecgo]").first.click(); await pg.wait_for_timeout(500)
        st = await pg.evaluate("(()=>{const S=__dbg.save(); return {g:S.gold, p:PERKS.pointsLeft(S), l:S.pendingLevels, hb:S.hpBonus+S.spBonus}})()")
        print(st)
        ok(st["g"] == 5000 and st["p"] == 5 and st["l"] == 5 and st["hb"] == 0, "gold paid, everything back in the pool")
        ok(not errs, f"no page errors {errs}")
        await b.close()
    print("RESULT", "OK" if not fails else f"FAIL {len(fails)}")
asyncio.run(main())
