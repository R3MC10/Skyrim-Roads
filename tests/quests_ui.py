import asyncio, sys
from playwright.async_api import async_playwright
_SHOTS = (__import__("os").environ.get("SHOTS") or __import__("os").path.join(__import__("tempfile").gettempdir(), "rotn_shots")).replace("\\", "/").rstrip("/") + "/"   # screenshots: $SHOTS or the temp folder
__import__("os").makedirs(_SHOTS, exist_ok=True)
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=qw"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Quinn"); await pg.click("#begin"); await pg.wait_for_timeout(1000)
        await pg.evaluate("""()=>{const S=window.__dbg.save(); S.level=20; S.location='Solitude'; [S.x,S.y]=WORLD.places.Solitude; S.discovered.push('Shrine of Azura');}""")
        async def closeall():
            for _ in range(5):
                if await pg.query_selector("#modal [data-act=close]"): await pg.click("#modal [data-act=close]"); await pg.wait_for_timeout(200)
        await closeall()
        await pg.click("[data-tab=log]"); await pg.wait_for_timeout(500)
        txt = await pg.evaluate("document.querySelector('#panel')?.innerText || document.body.innerText")
        print("journal has CW:", "Civil War" in txt, "Azura:", "Azura" in txt, "Sheogorath shown:", "Mind of Madness" in txt)
        btn = await pg.query_selector("[data-act=qjoin][data-id=cw_imperial]"); print("join button:", bool(btn))
        if btn: await btn.click(); await pg.wait_for_timeout(400); await closeall()
        await pg.click("[data-tab=log]"); await pg.wait_for_timeout(400)
        await pg.screenshot(path=_SHOTS + "quests_journal.png")
        txt = await pg.evaluate("document.body.innerText"); print("Stormcloaks hidden:", "for the Stormcloaks" not in txt, "active:", "Joining the Legion" in txt)
        await pg.evaluate("""()=>{const S=window.__dbg.save(); S.quests.cw_imperial.stage=4; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun;}""")
        await pg.click("[data-tab=town]"); await pg.wait_for_timeout(600); await closeall()
        print("town line:", await pg.evaluate("document.querySelector('.cw-hold')?.innerText"))
        el = await pg.query_selector(".cw-hold")
        if el: await el.screenshot(path=_SHOTS + "quests_town.png")
        await pg.evaluate("""()=>{const S=window.__dbg.save(); const id=G.give(S,'dawnbreaker'); G.equip(S,id); G.give(S,'wabbajack');}""")
        print("errors:", errs)
        await b.close()
asyncio.run(main())
