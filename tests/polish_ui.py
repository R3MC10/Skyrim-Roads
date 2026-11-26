import asyncio, sys
from playwright.async_api import async_playwright
_SHOTS = (__import__("os").environ.get("SHOTS") or __import__("os").path.join(__import__("tempfile").gettempdir(), "rotn_shots")).replace("\\", "/").rstrip("/") + "/"   # screenshots: $SHOTS or the temp folder
__import__("os").makedirs(_SHOTS, exist_ok=True)
PORT = sys.argv[1] if len(sys.argv) > 1 else "8780"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://127.0.0.1:{PORT}/index.html?net=bc&notut&p=pol"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Polly"); await pg.click("#begin"); await pg.wait_for_timeout(2500)
        clear = "document.querySelectorAll('#modal').forEach(m=>m.remove())"
        await pg.evaluate(clear)
        for style in ["ink"]:
            await pg.evaluate(f"()=>{{ POLISH.texture(); }}")
            for t in ["world", "hero", "follower", "town", "log"]:
                await pg.evaluate(clear)
                await pg.click("[data-tab=hero]" if t == "follower" else f"[data-tab={t}]")
                if t == "follower": await pg.wait_for_timeout(250); await pg.click("[data-act=tabgo][data-id=follower]")   # Character -> Follower (the Tactics page is gone)
                await pg.wait_for_timeout(450)
                await pg.screenshot(path=_SHOTS + f"pol_{style}_{t}.png")
            await pg.evaluate("window.scrollTo(0,0)")
            # banners & gold & level-up
            await pg.evaluate("()=>{ POLISH.fromText('You hit hard. One-Handed increased to 26'); }")
            await pg.wait_for_timeout(500); await pg.screenshot(path=_SHOTS + f"pol_{style}_skill.png")
            await pg.wait_for_timeout(2600)
            await pg.evaluate("()=>POLISH.fromText('\ue103 The Dragonborn: “Before the Storm” done (50 gold).')")
            await pg.wait_for_timeout(500); await pg.screenshot(path=_SHOTS + f"pol_{style}_quest.png"); await pg.wait_for_timeout(2600)
            await pg.evaluate("()=>{ const S=window.__dbg.save(); S.discovered.push('Thalmor Embassy','Dragon Bridge'); }")
            await pg.wait_for_timeout(2200); await pg.screenshot(path=_SHOTS + f"pol_{style}_disc.png"); await pg.wait_for_timeout(2500)
            await pg.evaluate("()=>{ const S=window.__dbg.save(); S.gold += 250; S.pendingLevels=(S.pendingLevels||0)+1; S.level+=1; }")
            await pg.wait_for_timeout(1300); await pg.screenshot(path=_SHOTS + f"pol_{style}_level.png"); await pg.wait_for_timeout(3400)
            await pg.evaluate("()=>POLISH.fromText('\ue130 Achievement: \ue144 First Steps')")
            await pg.wait_for_timeout(500); await pg.screenshot(path=_SHOTS + f"pol_{style}_ach.png"); await pg.wait_for_timeout(2600)
            # a modal + toast
            await pg.evaluate(clear); await pg.click("#sndBtn"); await pg.wait_for_timeout(400); await pg.screenshot(path=_SHOTS + f"pol_{style}_modal.png")
            await pg.evaluate(clear)
        print("errors:", errs); print("RESULT", "OK" if not errs else "FAIL")
        await b.close()
asyncio.run(main())
