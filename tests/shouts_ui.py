import asyncio, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8838"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        errs, bad = [], []
        def ok(v, m):
            print(("ok   " if v else "FAIL ") + m)
            if not v: bad.append(m)
        for style in ["ink"]:
            ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2)
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=sh{style}"); await pg.wait_for_timeout(1800)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Dovah"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
            clr = "document.querySelectorAll('#modal').forEach(m=>m.remove())"
            await pg.evaluate(f"()=>{{if (typeof POLISH!=='undefined') POLISH.texture();}}")
            await pg.evaluate("""()=>{const S=window.__dbg.save(); S.souls=2; S.location='High Hrothgar'; POWERS.greybeards(S);
                for (const n of ['Folgunthur','Skyborn Altar']) SHOUTS2.readWall(S, n); SHOUTS2.takeWall(); SHOUTS2.readWall(S, 'Labyrinthian'); }""")
            # the Word Wall scene
            await pg.evaluate(clr); await pg.evaluate("SHOUTS2.showWall()"); await pg.wait_for_timeout(1700)
            ok(await pg.query_selector("#wwall .ww-word") is not None, f"{style}: wall scene shows")
            ok((await pg.inner_text("#wwall .ww-word")).strip() == "TIID", f"{style}: the word is TIID")
            await pg.screenshot(path=f"sh_wall_{style}.png")
            await pg.click("#wwall [data-ww]"); await pg.wait_for_timeout(600)
            ok(await pg.query_selector("#wwall") is None, f"{style}: wall scene closes")
            # Magic → Shouts
            await pg.evaluate(clr); await pg.click("[data-tab=pack]"); await pg.wait_for_timeout(400)
            await pg.click("[data-act=skytab][data-id=magic]"); await pg.wait_for_timeout(300)
            await pg.evaluate(clr); await pg.click("#sky .sky-cat[data-id=shouts]"); await pg.wait_for_timeout(300)
            rows = await pg.evaluate("[...document.querySelectorAll('#sky .sky-row')].map(b=>b.textContent.trim())")
            ok(any("Dragon souls" in r for r in rows), f"{style}: souls row")
            ok(any("Frost Breath" in r for r in rows) and any("Slow Time" in r for r in rows), f"{style}: learned shouts listed")
            ok(any("Storm Call" in r and "not learned" in r for r in rows), f"{style}: unlearned shouts listed")
            idx = next(i for i, t in enumerate(rows) if "Frost Breath" in t)
            await pg.click(f"#sky .sky-row >> nth={idx}"); await pg.wait_for_timeout(300)
            det = await pg.inner_text("#sky .sky-detail")
            ok("where to learn more" in det.lower() and "unlock fo" in det.lower(), f"{style}: detail shows hint and unlock " + det[-120:].replace("\n", " | "))
            await pg.click("#sky .sky-detail [data-act=unlock]"); await pg.wait_for_timeout(400)
            ok(await pg.evaluate("POWERS.level(window.__dbg.save(),'frost_breath')") == 1, f"{style}: unlocked FO")
            await pg.screenshot(path=f"sh_menu_{style}.png")
            idx = next(i for i, t in enumerate(await pg.evaluate("[...document.querySelectorAll('#sky .sky-row')].map(b=>b.textContent.trim())")) if "Storm Call" in t)
            await pg.click(f"#sky .sky-row >> nth={idx}"); await pg.wait_for_timeout(300)
            det = await pg.inner_text("#sky .sky-detail")
            ok("word walls" in det.lower() or "know any" in det.lower(), f"{style}: hint for an unlearned shout " + det[:140].replace("\n", " | "))
            await pg.screenshot(path=f"sh_hint_{style}.png")
            await ctx.close()
        print("errors:", errs)
        print("RESULT", "OK" if not bad and not errs else "FAIL " + str(len(bad)))
        await b.close()
asyncio.run(main())
