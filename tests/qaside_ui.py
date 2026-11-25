"""Side-systems bug hunt regressions (claude/qa-side-*), in the real game on a phone (390x844, touch) and a PC (1920x1080).
Usage: python qaside_ui.py PORT -> RESULT OK
- Company: a quick double tap on Found / Put in / Give used to run twice (gold paid twice, below zero, ingots given twice).
- The phone back button leaves a mini-game instead of switching the tab under it.
- Updates wait while a mini-game is open (fishing, mining, the forge...), so a restart never eats a catch."""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

CLEAN = "() => document.querySelectorAll('#modal,.obtip,.toast,#toast,.pban,#folbark,#bark,#lvlpick').forEach(m => m.remove())"

async def company(pg, tag):
    await pg.evaluate("""() => { const S = window.__dbg.save(); S.trip = null; S.dungeon = null; S.location = 'Whiterun'; [S.x, S.y] = WORLD.places.Whiterun;
      S.gold = 5000; G.give(S, 'mat_iron', 10); }""")
    await pg.evaluate("() => window.__ui.jump({ tab: 'social', soc: 'company' })"); await pg.evaluate(CLEAN); await pg.wait_for_timeout(300)
    await pg.fill("#lng-name", "Double Tap Co")
    cost = await pg.evaluate("() => LONGHOUSE.foundCost(window.__dbg.save())")
    # two taps in the same moment
    await pg.evaluate("() => { const b = document.querySelector('[data-lng=found]'); b.click(); b.click(); }"); await pg.wait_for_timeout(800)
    g = await pg.evaluate("() => window.__dbg.save().gold")
    # (a small purse reward can land meanwhile, so only check it was not paid twice)
    ok(g >= 0 and cost * 0.9 <= 5000 - g < cost * 1.5, f"{tag}: founding a company with a double tap pays once ({5000 - g} of {cost})")
    await pg.evaluate(CLEAN)
    await pg.evaluate("() => window.__ui.jump({ tab: 'social', soc: 'company' })"); await pg.wait_for_timeout(200)
    await pg.evaluate("() => document.querySelector('[data-lng=tab][data-id=gold]').click()"); await pg.wait_for_timeout(300)
    await pg.evaluate("() => { const S = window.__dbg.save(); S.gold = 100; }")
    await pg.fill("#lng-amt", "100")
    await pg.evaluate("() => { const b = document.querySelector('[data-lng=dep]'); b.click(); b.click(); }"); await pg.wait_for_timeout(800)
    g = await pg.evaluate("() => window.__dbg.save().gold")
    t = await pg.evaluate("() => LONGHOUSE.derive(LONGHOUSE.mine(window.__dbg.save())).gold")
    ok(g >= 0 and t == 100, f"{tag}: double tap on Put in puts 100 gold in once (purse {g}, treasury {t})")
    give = await pg.query_selector("[data-lng=give][data-id=mat_iron]")
    if give:
        await pg.evaluate("() => { const b = document.querySelector('[data-lng=give][data-id=mat_iron]'); b.click(); b.click(); }"); await pg.wait_for_timeout(800)
        st = await pg.evaluate("() => LONGHOUSE.derive(LONGHOUSE.mine(window.__dbg.save())).mats.mat_iron || 0")
        left = await pg.evaluate("() => (window.__dbg.save().inv.find(r => r.item === 'mat_iron') || {qty: 0}).qty")
        ok(st + left == 10, f"{tag}: double tap on Give never makes ingots out of nothing (stockpile {st} + pack {left})")

async def updates(pg, tag):
    await pg.evaluate(CLEAN)
    await pg.evaluate("() => window.__ui.go('map')"); await pg.wait_for_timeout(300)
    await pg.evaluate(CLEAN)
    base = await pg.evaluate("() => window.__ui.safeToUpdate()")
    for cls in ["craftgame", "smithgame", "lockpick"]:
        await pg.evaluate(f"() => {{ const d = document.createElement('div'); d.className = '{cls}'; d.id = 'qa-mg'; document.body.appendChild(d); }}")
        s = await pg.evaluate("() => window.__ui.safeToUpdate()")
        await pg.evaluate("() => document.querySelector('#qa-mg')?.remove()")
        ok(base and not s, f"{tag}: no update restart while a .{cls} mini-game is open (idle {base}, open {s})")

async def backkey(pg, tag):
    # the phone back button leaves a mini-game (like Esc) instead of switching the tab hidden under it
    await pg.evaluate("""() => { const S = window.__dbg.save(); S.trip = null; S.location = 'Riverwood'; [S.x, S.y] = WORLD.places.Riverwood; G.give(S, 'fishing_rod', 1); G.give(S, 'pickaxe', 1); }""")
    await pg.evaluate("() => window.__ui.jump({ tab: 'town', shop: 'fish' })"); await pg.evaluate(CLEAN); await pg.wait_for_timeout(300)
    await pg.evaluate("() => document.querySelector('[data-act=fishgo]')?.click()"); await pg.wait_for_timeout(500)
    opened = await pg.evaluate("() => !!document.querySelector('#fishgame')")
    t0 = await pg.evaluate("() => document.querySelector('#tabs .on, .tabs .on')?.textContent || ''")
    r = await pg.evaluate("() => window.__ui.back()"); await pg.wait_for_timeout(400)
    gone = await pg.evaluate("() => !document.querySelector('#fishgame')")
    t1 = await pg.evaluate("() => document.querySelector('#tabs .on, .tabs .on')?.textContent || ''")
    ok(opened and r and gone and t0 == t1, f'{tag}: back closes the fishing game and stays on the same tab (open {opened}, closed {gone}, tab {t0!r} -> {t1!r})')
    await pg.evaluate(CLEAN)
    await pg.evaluate("() => MINEGAME.play(window.__dbg.save(), Object.keys(SMITH.MINES)[0], () => {})"); await pg.wait_for_timeout(500)
    opened = await pg.evaluate("() => !!document.querySelector('#minegame')")
    r = await pg.evaluate("() => window.__ui.back()"); await pg.wait_for_timeout(400)
    gone = await pg.evaluate("() => !document.querySelector('#minegame')")
    ok(opened and r and gone, f'{tag}: back closes the mining game (open {opened}, closed {gone})')
    await pg.evaluate("() => document.querySelectorAll('.craftgame,.lockpick,.smithgame').forEach(m => m.remove())")

async def main():
    async with async_playwright() as p:
        kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if os.path.exists(CHROME) else {}
        b = await p.chromium.launch(**kw)
        errs = []
        for vw, vh, tag in [(390, 844, "phone"), (1920, 1080, "pc")]:
            ctx = await b.new_context(viewport={"width": vw, "height": vh}, has_touch=tag == "phone")
            await ctx.add_init_script("localStorage.setItem('rotn_prefs', JSON.stringify({obTips:false,lang:'en'}))")
            pg = await ctx.new_page(); pg.on("pageerror", lambda e, t=tag: errs.append(t + " " + str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&minegame&p=qas{tag}"); await pg.wait_for_timeout(2000)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Qaside"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
            await company(pg, tag)
            await updates(pg, tag)
            await backkey(pg, tag)
            await ctx.close()
        ok(not errs, "no page errors " + str(errs[:3]))
        await b.close()
    print("RESULT " + ("OK" if not fails else "FAILED " + str(len(fails))))
    sys.exit(1 if fails else 0)

asyncio.run(main())
