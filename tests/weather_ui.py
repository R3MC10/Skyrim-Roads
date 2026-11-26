import asyncio, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8840"
FORCE = """(id)=>{ if (!window.__wx0) window.__wx0 = WEVENTS.weather; const r = window.__wx0; WEVENTS.weather = (p, t) => ({ ...r(p, t), id, name: WEVENTS.W[id][0], icon: WEVENTS.W[id][1], speed: WEVENTS.W[id][2], sneak: WEVENTS.W[id][3], encounters: WEVENTS.W[id][4] }); }"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        bad = []
        for style in ("ink",):
            ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2)
            errs = []
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=wx{style}&fightanim"); await pg.wait_for_timeout(1800)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Hrodi"); await pg.click("#begin"); await pg.wait_for_timeout(1000)
            async def clean(): await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            async def tab(t):
                await clean(); await pg.evaluate(f"document.querySelector('[data-tab={t}]').click()"); await pg.wait_for_timeout(500)
            ok = lambda c, m: (print(("ok   " if c else "FAIL ") + m), None if c else bad.append(f"{style}: {m}"))
            # a blizzard in the wilds near Winterhold, no warm clothes: the cold meter shows on Travel
            await pg.evaluate(FORCE, "blizzard")
            await pg.evaluate("""()=>{const S=window.__dbg.save(); S.location=null; const w=WORLD.places.Winterhold; S.x=w[0]+0.01; S.y=w[1]+0.01; for (const sl of ['chest','head','hands','feet']) G.unequip(S, sl); S.coldV=82; S.coldT=G.now();}""")
            await tab("log"); await tab("world")
            cold = await pg.evaluate("document.querySelector('.wxcold')?.innerText || ''")
            ok("Freezing" in cold, f"cold meter on Travel: {cold!r}")
            top = await pg.evaluate("document.querySelector('#clock')?.innerText || document.querySelector('#clock')?.title || ''")
            ok("Freezing" in top or "Blizzard" in top, f"top bar shows weather/cold: {top!r}")
            el = await pg.query_selector(".wxcold")
            if el: await el.screenshot(path=f"wx_cold_{style}.png")
            # a fight in a blizzard knows its weather (the log summary names it)
            wx = await pg.evaluate("(()=>{const S=window.__dbg.save(); const f=new G.Fight(G.clone(S), G.scaleEnemy(D.ENCOUNTERS.find(e=>e.kind!=='event'), S.level)); f.run(); return (f.wx&&f.wx.name)||''})()")
            ok("Blizzard" in wx, f"a fight knows the blizzard: {wx!r}")
            # encounter-style note
            await pg.evaluate(FORCE, "rain")
            note = await pg.evaluate("WFX.noteHTML(window.__dbg.save())")
            ok("fire spells" in note, "rain note explains fire/shock")
            # compass forecast
            await clean(); await pg.evaluate("TABMENU.openHub && TABMENU.openHub()"); await pg.wait_for_timeout(1500)
            fc = await pg.evaluate("document.querySelector('.tw-fc')?.innerText || ''")
            ok("Forecast" in fc, f"compass forecast: {fc!r}")
            await pg.screenshot(path=f"wx_compass_{style}.png")
            await pg.evaluate("TABMENU.closeHub && TABMENU.closeHub()"); await pg.wait_for_timeout(400)
            # settings: the Survival switch turns the cold off
            await clean()
            await pg.evaluate("document.querySelector('#sndBtn')?.click()"); await pg.wait_for_timeout(600)
            row = await pg.evaluate("[...document.querySelectorAll('.setrow')].map(r=>r.innerText).find(t=>t.includes('Cold meter')) || ''")
            ok("Cold meter" in row, f"settings row: {row!r}")
            sw = await pg.query_selector("[data-k=survival][data-v=false]")
            if sw:
                await sw.click(); await pg.wait_for_timeout(400)
                off = await pg.evaluate("window.__dbg.save().survival === false && !window.__dbg.save().coldV")
                ok(off, "Survival off clears the cold")
            else: ok(False, "survival switch found")
            await pg.screenshot(path=f"wx_settings_{style}.png")
            ok(not errs, f"no page errors {errs[:3]}")
            await ctx.close()
        await b.close()
        print("RESULT", "OK" if not bad else "FAIL " + "; ".join(bad))
asyncio.run(main())
