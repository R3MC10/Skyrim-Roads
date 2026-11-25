"""SkyUI theme check: screenshots of every main screen. Usage: python3 skyui_ui.py PORT [tag]"""
import asyncio, sys
from playwright.async_api import async_playwright
_SHOTS = (__import__("os").environ.get("SHOTS") or __import__("os").path.join(__import__("tempfile").gettempdir(), "rotn_shots")).replace("\\", "/").rstrip("/") + "/"   # screenshots: $SHOTS or the temp folder
__import__("os").makedirs(_SHOTS, exist_ok=True)
PORT = sys.argv[1] if len(sys.argv) > 1 else "8795"
TAG = sys.argv[2] if len(sys.argv) > 2 else "after"
OUT = _SHOTS + "skyui/"; __import__("os").makedirs(OUT, exist_ok=True)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs, ext = [], []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("request", lambda r: ext.append(r.url) if "fonts.g" in r.url else None)
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=sk{TAG}"); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=OUT + f"{TAG}_title.png")
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Sigrid"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
        async def clear():
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        await pg.evaluate("""()=>{const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.gold=900; S.discovered.push('Whiterun');
          G.give(S,'iron_sword'); G.give(S,'potion_health',3); G.give(S,'gem_ruby',2); G.give(S,'tome_firebolt'); S.pendingLevels=1;
          const t=G.now(); let k=t; while(!G.shopsOpen(k)) k+=600; window.__shopT=k; }""")
        await pg.wait_for_timeout(500); await clear()
        async def tab(t, name, full=True):
            await clear(); await (pg.click("[data-tab=hero]") if t == "follower" else pg.click(f"[data-tab={t}]")); await pg.wait_for_timeout(300)
            if t == "follower": await pg.click("[data-act=tabgo][data-id=follower]")   # Character -> Follower (the Tactics page is gone)
            await pg.wait_for_timeout(600); await clear()
            await pg.screenshot(path=OUT + f"{TAG}_{name}.png", full_page=full)
            el = await pg.query_selector("#side")
            if el: await el.screenshot(path=OUT + f"{TAG}_{name}_side.png")
        await tab("map", "travel", False)
        await pg.evaluate("window.scrollTo(0, 700)"); await pg.wait_for_timeout(200); await pg.screenshot(path=OUT + f"{TAG}_travel_panel.png")
        await tab("hero", "hero")
        await tab("follower", "follower")
        await tab("town", "town")
        # shop (barter)
        await clear(); await pg.click("[data-act=shop][data-id=general]"); await pg.wait_for_timeout(400)
        el = await pg.query_selector("#side"); await el.screenshot(path=OUT + f"{TAG}_shop.png")
        # the Area tab groups places into tiles (areaui.js): back to the board, then the Inn tile
        await clear(); await pg.evaluate("window.__ui.go('town')"); await pg.wait_for_timeout(400)
        await pg.evaluate("(document.querySelector('[data-act=shop][data-id=inn]') || document.querySelector('#side .au-tile[data-id=inn]'))?.click()"); await pg.wait_for_timeout(400)
        await pg.evaluate("document.querySelector('[data-act=shop][data-id=inn]')?.click()"); await pg.wait_for_timeout(400)
        el = await pg.query_selector("#side"); await el.screenshot(path=OUT + f"{TAG}_inn.png")
        await tab("log", "journal")
        # pack menu (items / magic / skills)
        await clear(); await pg.click("[data-tab=pack]"); await pg.wait_for_timeout(600)
        await pg.screenshot(path=OUT + f"{TAG}_menu_worn.png")
        for pgid in ["items", "magic", "skills"]:
            b2 = await pg.query_selector(f"[data-act=skytab][data-id={pgid}]")
            if b2: await b2.click(); await pg.wait_for_timeout(400)
            if pgid == "items":
                c = await pg.query_selector("[data-act=skycat][data-id=all]")
                if c: await c.click(); await pg.wait_for_timeout(300)
            r = await pg.query_selector(".sky-row")
            if r: await r.click(); await pg.wait_for_timeout(300)
            await pg.screenshot(path=OUT + f"{TAG}_menu_{pgid}.png")
        await pg.evaluate("document.querySelector('#sky')?.remove(); document.querySelectorAll('.sky').forEach(x=>x.remove())")
        # encounter + message + death
        await clear(); await pg.evaluate("window.__dbg.openEvent && window.__dbg.openEvent('shrine')"); await pg.wait_for_timeout(600)
        await pg.screenshot(path=OUT + f"{TAG}_event.png")
        await clear(); await pg.evaluate("window.__dbg.message('Quest completed','Before the Storm. The Jarl thanks you.',false)"); await pg.wait_for_timeout(500)
        await pg.screenshot(path=OUT + f"{TAG}_message.png")
        await clear(); await pg.evaluate("window.__dbg.message('You died','A bandit outlaw killed you on the road.',true)"); await pg.wait_for_timeout(500)
        await pg.screenshot(path=OUT + f"{TAG}_death.png")
        await clear()
        # dungeon
        await pg.evaluate("""()=>{const S=window.__dbg.save(); S.location='Bleak Falls Barrow'; [S.x,S.y]=WORLD.places['Bleak Falls Barrow']; S.discovered.push('Bleak Falls Barrow');}""")
        await tab("map", "dungeon_out", False)
        e = await pg.query_selector("[data-act=enter]")
        if e: await e.click(); await pg.wait_for_timeout(800); await clear(); await pg.screenshot(path=OUT + f"{TAG}_dungeon.png")
        print("errors:", errs, "| google font requests:", len(ext))
        await b.close()
asyncio.run(main())
