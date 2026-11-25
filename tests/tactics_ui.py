"""Tactics rules on the AI & Loadouts screen: add rules (Custom tactics), switch one off, the preset confirm, rules survive a
reload, a test fight, and the "What would the AI do?" tester (moving the health slider below 50% switches the ticked rule).
Usage: python tactics_ui.py PORT   (serve the game with: node serve.js PORT); shots go to $SHOTS."""
import asyncio, os, sys, tempfile
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8766"
_SHOTS = (os.environ.get("SHOTS") or os.path.join(tempfile.gettempdir(), "rotn_shots")).replace("\\", "/").rstrip("/") + "/"
os.makedirs(_SHOTS, exist_ok=True)
fails = []
def ok(c, msg):
    print(("ok   " if c else "FAIL ") + msg)
    if not c: fails.append(msg)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROME") or None, args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        async def clear():
            await pg.evaluate("document.querySelectorAll('#modal,#sky').forEach(m=>m.remove())")
        async def open_tactics():
            await clear(); await pg.evaluate("window.__ui.go('tactics')"); await pg.wait_for_timeout(400)
        await pg.goto(f"http://127.0.0.1:{PORT}/index.html?net=bc&notut&p=tx"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Tacto"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        await pg.evaluate("()=>{const S=window.__dbg.save(); G.give(S,'potion_health_minor',5);}")
        await open_tactics()
        # Smart AI is the default: your rules sit folded in one row; Custom tactics shows the editor
        ok(await pg.evaluate("!!document.querySelector('#side .rulesfold:not([open])')"), "Smart AI: rules folded")
        await pg.click("#side .aimode [data-id=custom]"); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("G.loadout(window.__dbg.save()).mode") == "custom", "Custom tactics on")
        n0 = await pg.evaluate("G.loadout(window.__dbg.save()).rules.length")
        # rule A: first turn -> power attack
        await pg.select_option("#tc", "first_turn"); await pg.wait_for_timeout(200)
        await pg.select_option("#ta", "power_attack"); await pg.click("[data-act=radd]"); await pg.wait_for_timeout(300)
        # rule B: turn >= 3 -> block
        await pg.select_option("#tc", "turn_at_least"); await pg.wait_for_timeout(200)
        await pg.select_option("#tp", "3"); await pg.select_option("#ta", "block"); await pg.click("[data-act=radd]"); await pg.wait_for_timeout(300)
        rules = await pg.evaluate("JSON.stringify(G.loadout(window.__dbg.save()).rules)")
        ok(await pg.evaluate("G.loadout(window.__dbg.save()).rules.length") == n0 + 2, "two rules added")
        # switch rule 1 off
        await pg.click("[data-act=roff][data-i='0']"); await pg.wait_for_timeout(200)
        ok(await pg.evaluate("!!G.loadout(window.__dbg.save()).rules[0].off"), "rule 1 switched off")
        # preset needs confirmation
        await pg.click("[data-act=preset][data-id=mage]"); await pg.wait_for_timeout(200)
        ok(await pg.is_visible("[data-act=presetyes]"), "preset asks first")
        await pg.click("[data-act=presetno]"); await pg.wait_for_timeout(200)
        await pg.locator("#side").screenshot(path=_SHOTS + "tactics_cards.png")
        # the tester: health below 50% -> the ticked rule switches
        await pg.evaluate("()=>{const L=G.loadout(window.__dbg.save()); L.rules.unshift({if:'hp_below',pct:50,do:'block'}); AITEST.reset(); window.__ui.go('tactics')}")
        await pg.wait_for_timeout(400)
        fired = "()=>[...document.querySelectorAll('#aitout .aitrule')].findIndex(r=>r.classList.contains('fire'))+1"
        hi = await pg.evaluate(fired)
        ok(hi > 1, f"full health: a later rule is ticked ({hi})")
        await pg.locator("#aitcard .aitslide[data-k=hp]").fill("40"); await pg.wait_for_timeout(400)
        ok(await pg.evaluate(fired) == 1, "health 40%: rule 1 (health below 50% -> block) is ticked")
        ok("rule needs below 50%" in await pg.evaluate("document.querySelector('#aitout .aitrule.fire small').textContent"), "the ticked rule says why")
        await pg.locator("#aitcard").screenshot(path=_SHOTS + "tactics_tester.png")
        # reload: rules survive
        rules = await pg.evaluate("JSON.stringify(G.loadout(window.__dbg.save()).rules)")
        await pg.evaluate("window.__dbg.persist && window.__dbg.persist()")
        await pg.reload(); await pg.wait_for_timeout(1800)
        if await pg.query_selector(".press"): await pg.click(".press"); await pg.wait_for_timeout(300)
        if await pg.query_selector(".mi[data-t=continue]"): await pg.click(".mi[data-t=continue]"); await pg.wait_for_timeout(1500)
        after = await pg.evaluate("JSON.stringify(G.loadout(window.__dbg.save()).rules)")
        ok(after == rules or after.count('"if"') >= n0 + 2, "rules survive a reload")
        # test fight
        await open_tactics()
        await pg.select_option("#te", "Bandit outlaw"); await pg.click("[data-act=test]"); await pg.wait_for_timeout(500)
        ok(await pg.evaluate("!!document.querySelector('#side .flog')"), "test fight log drawn")
        ok(not errs, f"no page errors {errs[:3]}")
        await b.close()
    print("RESULT", "OK" if not fails else "FAIL " + "; ".join(fails))
asyncio.run(main())
