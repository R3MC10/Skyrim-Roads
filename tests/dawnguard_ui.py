"""The vampire war (dawnguard.js) in the browser: phone (390x844), ink and pixel (LANG_UI=pl for Polish).
Usage: python dawnguard_ui.py PORT -> RESULT OK
Finishes the opening, stands in Harkon's hall and checks both sides are offered in the Journal, picks Harkon's court,
drinks his blood (story picture), looks at Castle Volkihar and Fort Dawnguard in the Area tab, and checks the
Dawnguard side is closed after that. Screenshots: tests/out_dawnguard/."""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
LANG = os.environ.get("LANG_UI", "en")
WORDS = {"en": ["Dawnguard: Hunt the Night", "Volkihar: Harkon's Gift"], "pl": ["Straż Świtu: Łowy na noc", "Volkihar: Dar Harkona"]}[LANG]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_dawnguard") + os.sep; os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

SETUP = """(st) => { ART.setStyle(st); const S = window.__dbg.save(); S.gold = 5000; S.level = 18; S.trip = null; S.dungeon = null;
  S.quests = S.quests || {}; S.quests.dg_awakening = { stage: 3, t: G.now(), done: true };
  S.location = 'Castle Volkihar'; [S.x, S.y] = WORLD.places['Castle Volkihar']; S.discovered = [...new Set([...(S.discovered || []), 'Castle Volkihar', 'Fort Dawnguard', 'Dimhollow Crypt'])];
  G.setHealth(S, G.maxHealth(S)); window.__dbg.publish(); return QUESTS.canJoin(S, 'dg_dawnguard') + ':' + QUESTS.canJoin(S, 'dg_volkihar'); }"""

async def main():
    async with async_playwright() as p:
        kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if os.path.exists(CHROME) else {}
        b = await p.chromium.launch(**kw)
        errs = []
        for style in ["ink", "pixel"]:
            name = f"phone_{style}" + ("" if LANG == "en" else "_" + LANG)
            ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, has_touch=True)
            await ctx.add_init_script(f"localStorage.setItem('rotn_prefs', JSON.stringify({{artStyle:'{style}',obTips:false,lang:'{LANG}'}}))")
            pg = await ctx.new_page(); pg.on("pageerror", lambda e, n=name: errs.append(n + " " + str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=dg{name}"); await pg.wait_for_timeout(2000)
            await pg.wait_for_selector(".press", timeout=60000); await pg.click(".press")
            await pg.wait_for_selector(".mi[data-t=new]", timeout=30000); await pg.click(".mi[data-t=new]")
            await pg.wait_for_selector("#nm", timeout=30000); await pg.fill("#nm", "Dawntest"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
            await pg.add_style_tag(content="#pbanners,.pban,.pburst,.pgold,.toast,#toast{display:none!important}")   # other systems' banners, not ours
            res = await pg.evaluate(SETUP, style)
            ok(res == "true:true", f"{name}: both sides can be picked in Harkon's hall ({res})")
            async def clean(): await pg.evaluate("() => document.querySelectorAll('#modal,.modal,#xgame,.obtip,.toast,#toast,.pban').forEach(m => m.remove())")
            async def tab(t):
                await clean()
                await pg.evaluate(f"() => {{ const b = document.querySelector('[data-tab={t}]'); if (b) b.click(); }}"); await pg.wait_for_timeout(600)
            async def shot(fn, sel=None):
                await pg.wait_for_timeout(500)
                if sel: await pg.evaluate(f"() => document.querySelector(\"{sel}\")?.scrollIntoView({{block:'center'}})"); await pg.wait_for_timeout(300)
                await pg.screenshot(path=OUT + fn)
            # 1. the Journal offers both sides
            await tab("log")
            txt = await pg.evaluate("document.body.innerText")
            ok(all(w in txt for w in WORDS), f"{name}: both side lines listed in the Journal")
            ok(await pg.query_selector("[data-act=qjoin][data-id=dg_dawnguard]") is not None and await pg.query_selector("[data-act=qjoin][data-id=dg_volkihar]") is not None, f"{name}: two Join buttons")
            await shot(f"{name}_choice.png", "[data-act=qjoin][data-id=dg_volkihar]")
            # 2. side with Harkon: the story popup has a picture
            await pg.click("[data-act=qjoin][data-id=dg_volkihar]"); await pg.wait_for_timeout(700)
            ok(await pg.query_selector("#modal canvas, #modal img, .modal canvas, .modal img") is not None, f"{name}: the choice shows a story picture")
            await shot(f"{name}_join_volkihar.png")
            side = await pg.evaluate("() => DAWNGUARD.side(window.__dbg.save())")
            ok(side == "volkihar", f"{name}: sided with Harkon ({side})")
            # 3. drink his blood from the quest card
            await tab("log")
            ok(await pg.query_selector("[data-act=qtalk][data-id=dg_volkihar]") is not None, f"{name}: Drink Harkon's blood button on the quest card")
            await pg.evaluate("() => document.querySelector('[data-act=qtalk][data-id=dg_volkihar]')?.click()"); await pg.wait_for_timeout(900)
            vamp = await pg.evaluate("() => !!window.__dbg.save().vampire")
            ok(vamp, f"{name}: Harkon's blood made you a vampire")
            await shot(f"{name}_harkon_blood.png")
            # 4. the Dawnguard is closed now, and hidden
            await tab("log")
            ok(await pg.query_selector("[data-act=qjoin][data-id=dg_dawnguard]") is None, f"{name}: no Dawnguard Join after siding with Harkon")
            await shot(f"{name}_journal_volkihar.png", "[data-id=dg_volkihar]")
            # 5. the places in the Area tab
            await tab("town"); await shot(f"{name}_castle_volkihar.png")
            await pg.evaluate("() => { const S = window.__dbg.save(); S.location = 'Fort Dawnguard'; [S.x, S.y] = WORLD.places['Fort Dawnguard']; window.__dbg.publish(); }")
            await tab("map"); await tab("town"); await shot(f"{name}_fort_dawnguard.png")
            over = await pg.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
            ok(over <= 1, f"{name}: no sideways scroll ({over})")
            await ctx.close()
        ok(not errs, "no page errors: " + "; ".join(errs[:3]))
        await b.close()
    print("RESULT", "OK" if not fails else "FAIL " + str(len(fails)))
asyncio.run(main())
