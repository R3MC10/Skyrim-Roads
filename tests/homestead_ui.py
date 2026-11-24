# Homesteads screen (homestead.js) on a phone, in both art styles.
# python -m http.server 9040 --directory game ; python tests/homestead_ui.py 9040 [screenshot dir]
import asyncio, sys, os, shutil
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8847"
OUT = sys.argv[2] if len(sys.argv) > 2 else "."
os.makedirs(OUT, exist_ok=True)

async def main():
    async with async_playwright() as p:
        exe = shutil.which("google-chrome") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
        b = await p.chromium.launch(**({"executable_path": exe} if exe else {}), args=["--no-sandbox"])
        bad = []
        for style in ("ink", "pixel"):
            ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2)
            errs = []
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=hs{style}"); await pg.wait_for_timeout(1800)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Builder"); await pg.click("#begin"); await pg.wait_for_timeout(1000)
            await pg.evaluate(f"ART.setStyle('{style}')")
            ok = lambda c, m: (print(("ok   " if c else "FAIL ") + f"[{style}] " + m), None if c else bad.append(f"{style}: {m}"))
            async def clean(): await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            async def tab(t):
                await clean(); await pg.evaluate(f"document.querySelector('[data-tab={t}]').click()"); await pg.wait_for_timeout(500)
            async def click(sel):
                await clean(); await pg.evaluate(f"document.querySelector({sel!r})?.click()"); await pg.wait_for_timeout(450)
            async def shot(name):
                for _ in range(3):  # the panel can re-render mid-shot; try again
                    try:
                        await pg.wait_for_timeout(200); el = await pg.query_selector("div.hs")
                        if el: await el.screenshot(path=os.path.join(OUT, f"hs_{name}_{style}.png"), timeout=5000)
                        return
                    except Exception: pass
            async def overflow(): return await pg.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
            # stand in Falkreath with gold, iron, firewood and a pickaxe
            await pg.evaluate("""()=>{const S=window.__dbg.save(); S.location='Falkreath'; [S.x,S.y]=WORLD.places.Falkreath; S.gold=40000;
               G.give(S,'mat_iron',30); G.give(S,'mat_firewood',10); G.give(S,'pickaxe',1);}""")
            await tab("town")
            has = await pg.evaluate("!!document.querySelector('[data-act=shop][data-id=homestead]')")
            ok(has, "Falkreath lists the homestead under Your home")
            await click("[data-act=shop][data-id=homestead]")
            ok(await pg.evaluate("!!document.querySelector('.hs img.art.scene')"), "plot picture drawn")
            await shot("deed")
            await click("[data-act=hsact][data-id=deed]")
            ok(await pg.evaluate("!!window.__dbg.save().homestead?.pinewatch"), "bought the deed")
            ok(await pg.evaluate("window.__dbg.save().gold===35000"), "deed cost 5000")
            await clean()
            # gather
            await click("[data-act=hsact][data-id=view][data-c=gather]")
            for k in ("saw", "quarry", "clay"):
                await click(f"[data-act=hsact][data-id=gather][data-c={k}]")
            st = await pg.evaluate("window.__dbg.save().homestead.pinewatch.stock")
            ok(st.get("log", 0) >= 4 and st.get("stone", 0) >= 3 and st.get("clay", 0) >= 2, f"sawmill, quarry and clay pit work {st}")
            ok(await pg.evaluate("document.querySelectorAll('.hs .hswhy').length>=3"), "cooldowns shown after working")
            await shot("gather")
            # workbench
            await click("[data-act=hsact][data-id=view][data-c=bench]")
            await click("[data-act=hsact][data-id=make][data-c='nails:1']")
            ok(await pg.evaluate("window.__dbg.save().homestead.pinewatch.stock.nails===20"), "made 20 nails at the workbench")
            await shot("bench")
            # top up and build everything
            await pg.evaluate("""()=>{Object.assign(window.__dbg.save().homestead.pinewatch.stock,{log:300,stone:300,clay:300,nails:500,hinge:40,lock:20,fittings:80,glass:60});}""")
            await click("[data-act=hsact][data-id=view][data-c=build]")
            ok(await pg.evaluate("document.querySelectorAll('.hs img.hsthumb').length>=10"), "a small picture for every stage and wing")
            await shot("build0")
            for w in ("small", "hall", "library", "greenhouse", "enchanter"):
                await click(f"[data-act=hsact][data-id=build][data-c={w}]")
                await clean()
                if w == "small": await shot("small")
                if w == "hall": await shot("hall")
            h = await pg.evaluate("window.__dbg.save().homestead.pinewatch")
            ok(h["small"] and h["hall"] and h["wings"] == ["library", "greenhouse", "enchanter"], f"built house, hall and three wings {h['wings']}")
            ok(await pg.evaluate("!document.querySelector('[data-act=hsact][data-id=build]:not([data-c=garden]):not([data-c=cellar])')"), "no more wing build buttons once full (garden and cellar don't take a wing space)")
            await shot("full")
            # home: sleep and collect a day later
            await click("[data-act=hsact][data-id=view][data-c=home]")
            await click("[data-act=hsact][data-id=sleep]")
            ok(await pg.evaluate("window.__dbg.save().restBonus===0.15"), "slept in own bed by the main hall's hearth: Well Rested +15%")
            await pg.evaluate("()=>{const h=window.__dbg.save().homestead.pinewatch; for (const w of h.wings) h.col[w]-=HOMESTEAD.DAY+5;}")
            await click("[data-act=hsact][data-id=view][data-c=home]")
            ok(await pg.evaluate("!!document.querySelector('.hs .hsready')"), "goods ready shown")
            await shot("home")
            gem0 = await pg.evaluate("window.__dbg.save().inv.filter(r=>r.item==='soul_gem_common').length")
            await click("[data-act=hsact][data-id=collect]")
            gem1 = await pg.evaluate("window.__dbg.save().inv.filter(r=>r.item==='soul_gem_common').length")
            ok(gem1 > gem0, "collected the enchanter's soul gem")
            # steward
            await click("[data-act=hsact][data-id=view][data-c=steward]")
            await click("[data-act=hsact][data-id=hire]")
            await clean()
            await click("[data-act=hsact][data-id=follow]")
            ok(await pg.evaluate("window.__dbg.save().follower?.id==='hs_pinewatch'"), "steward hired and following")
            await shot("steward")
            ok(not await overflow(), "no sideways scrolling on a phone")
            ok(len(errs) == 0, f"no page errors {errs[:3]}")
            await ctx.close()
        print("RESULT OK" if not bad else "RESULT FAIL " + "; ".join(bad))
        await b.close()
        sys.exit(1 if bad else 0)
asyncio.run(main())
