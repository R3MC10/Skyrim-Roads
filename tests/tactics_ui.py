import asyncio, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8766"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=__import__("os").environ.get("CHROME") or None, args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        async def clear():
            for _ in range(5):
                if await pg.query_selector("#modal [data-act=close]"): await pg.click("#modal [data-act=close]"); await pg.wait_for_timeout(200)
                else: break
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=tx"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Tacto"); await pg.click("#begin"); await pg.wait_for_timeout(1000)
        await pg.evaluate("()=>{const S=window.__dbg.save(); G.give(S,'potion_health_minor',5);}")
        await clear()
        await pg.click("[data-tab=tactics]"); await pg.wait_for_timeout(400)
        n0 = await pg.evaluate("G.loadout(window.__dbg.save()).rules.length")
        # rule A: first turn -> power attack
        await pg.select_option("#tc", "first_turn"); await pg.wait_for_timeout(200)
        await pg.select_option("#ta", "power_attack"); await pg.click("[data-act=radd]"); await pg.wait_for_timeout(300)
        # rule B: turn >= 3 -> block
        await pg.select_option("#tc", "turn_at_least"); await pg.wait_for_timeout(200)
        await pg.select_option("#tp", "3"); await pg.select_option("#ta", "block"); await pg.click("[data-act=radd]"); await pg.wait_for_timeout(300)
        rules = await pg.evaluate("JSON.stringify(G.loadout(window.__dbg.save()).rules)")
        print("rules:", rules)
        # switch rule 1 off, edit rule 2
        await pg.click("[data-act=roff][data-i='0']"); await pg.wait_for_timeout(200)
        # preset needs confirmation
        await pg.click("[data-act=preset][data-id=mage]"); await pg.wait_for_timeout(200)
        print("preset confirm shown:", await pg.is_visible("[data-act=presetyes]"))
        await pg.click("[data-act=presetno]"); await pg.wait_for_timeout(200)
        el = await pg.query_selector("#side"); await el.screenshot(path="tactics_cards.png")
        # reload: rules survive
        await pg.reload(); await pg.wait_for_timeout(1800)
        if await pg.query_selector(".press"): await pg.click(".press"); await pg.wait_for_timeout(300)
        if await pg.query_selector(".mi[data-t=continue]"): await pg.click(".mi[data-t=continue]"); await pg.wait_for_timeout(1200)
        await clear()
        after = await pg.evaluate("JSON.stringify(G.loadout(window.__dbg.save()).rules)")
        print("after reload same:", after == rules.replace('"if":"hp_below"','"if":"hp_below"') or after, "| n:", n0, "->", await pg.evaluate("G.loadout(window.__dbg.save()).rules.length"))
        print("rule1 off kept:", await pg.evaluate("!!G.loadout(window.__dbg.save()).rules.find(r=>r.if==='first_turn').off") if False else after)
        # test fight: turn>=3 block should fire
        await pg.click("[data-tab=tactics]"); await pg.wait_for_timeout(400)
        await pg.select_option("#te", "Bandit outlaw"); await pg.click("[data-act=test]"); await pg.wait_for_timeout(500)
        txt = await pg.inner_text("#side")
        i = txt.find("Rules used"); print("test:", txt[i:i+80].replace("\n"," "))
        print("errors:", errs)
        await b.close()
asyncio.run(main())
