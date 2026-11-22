import asyncio, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8834"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=ai"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Brynja"); await pg.click("#begin"); await pg.wait_for_timeout(1000)
        async def shut():
            for _ in range(6):
                m = await pg.query_selector("#modal [data-act=close]")
                if not m: break
                await m.click(); await pg.wait_for_timeout(200)
        async def click(sel):
            for _ in range(4):
                await shut()
                try: await pg.click(sel, timeout=3000); return
                except Exception: await pg.evaluate("document.querySelector('#modal')?.remove()")
            await pg.click(sel)
        await click("[data-tab=tactics]"); await pg.wait_for_timeout(600)
        st = await pg.evaluate("(()=>({smart: !!document.querySelector('.ai-smart'), on: document.querySelector('[data-act=aimode].on')?.dataset.id, desc: document.querySelector('.aidesc')?.innerText}))()")
        print("start:", st)
        assert st["smart"] and st["on"] == "smart", st
        el = await pg.query_selector("#side .panel")
        if el: await el.screenshot(path="ai_tactics_smart.png")
        # a test fight with Smart AI: the log marks the AI's moves
        await click("[data-act=test]"); await pg.wait_for_timeout(800)
        lg = await pg.evaluate("(()=>{const d=document.querySelector('.flog'); return d ? [d.innerText.includes('[AI]'), document.querySelector('.flog')?.closest('details')?.querySelector('summary')?.innerText, document.body.innerText.includes('Smart AI used')] : null})()")
        print("test fight:", lg)
        assert lg and lg[0] and lg[2], lg
        # switch to Custom: the rules fire again and the setting sticks
        await click("[data-act=aimode][data-id=custom]"); await pg.wait_for_timeout(400)
        st2 = await pg.evaluate("(()=>({smart: !!document.querySelector('.ai-smart'), mode: window.__dbg.save().loadouts[window.__dbg.save().loadout].mode, rules: window.__dbg.save().loadouts[window.__dbg.save().loadout].rules.length}))()")
        print("custom:", st2)
        assert not st2["smart"] and st2["mode"] == "custom" and st2["rules"] > 0, st2
        await click("[data-act=test]"); await pg.wait_for_timeout(800)
        lg2 = await pg.evaluate("document.querySelector('.flog')?.innerText.includes('[AI]')")
        assert lg2 is False, lg2
        el = await pg.query_selector("#side .panel")
        if el: await el.screenshot(path="ai_tactics_custom.png")
        await click("[data-act=aimode][data-id=smart]"); await pg.wait_for_timeout(300)
        # the pixel style too
        await pg.evaluate("(()=>{try{const S=window.__dbg.save(); S.artStyle='pixel';}catch(e){}})()")
        el = await pg.query_selector("#side .panel")
        if el: await el.screenshot(path="ai_tactics_smart2.png")
        print("errors:", errs)
        assert not errs
        print("RESULT OK")
        await b.close()
asyncio.run(main())
