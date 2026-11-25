"""Pick a side (sides.js, sidequest.js, cloaks.js, sideui.js) in the browser: phone (390x844) and PC (1366x900).
Usage: python sides_ui.py PORT -> RESULT OK      (LANG_UI=pl for Polish)
A level-21 hero gets the courier's letter, hears Galmar out in Windhelm from the Journal, swears to the Stormcloaks
(cloak put on), then opens Social -> Faction (rank XP bar, cloak ladder, standings) and the hero's look with the cloak.
Screenshots: tests/out_sides/."""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
LANG = os.environ.get("LANG_UI", "en")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_sides") + os.sep; os.makedirs(OUT, exist_ok=True)
CHROME = (__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None))
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

SETUP = """(st) => { if (typeof ART !== "undefined" && ART.setStyle) ART.setStyle(st); const S = window.__dbg.save(); S.gold = 2000; S.level = 21; S.trip = null; S.dungeon = null; S.side = null; S.sideAsked = false;
  S.quests = S.quests || {}; delete S.quests.cw_choice;
  S.location = 'Windhelm'; [S.x, S.y] = WORLD.places['Windhelm']; S.discovered = [...new Set([...(S.discovered || []), 'Windhelm', 'Solitude', 'Thalmor Embassy'])];
  G.setHealth(S, G.maxHealth(S)); QUESTS.ensure(S); window.__dbg.publish(); return !!S.quests.cw_choice && SIDES.shouldPrompt(S); }"""

CASES = [("phone_ink", 390, 844, "ink"), ("pc_ink", 1366, 900, "ink")]

async def main():
    async with async_playwright() as p:
        kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if CHROME and os.path.exists(CHROME) else {}
        b = await p.chromium.launch(**kw)
        errs = []
        for base, w, h, style in CASES:
            name = base + ("" if LANG == "en" else "_" + LANG)
            ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if w < 800 else 1, has_touch=w < 800)
            await ctx.add_init_script(f"localStorage.setItem('rotn_prefs', JSON.stringify({{artStyle:'{style}',obTips:false,lang:'{LANG}'}}))")
            pg = await ctx.new_page(); boot = []
            pg.on("pageerror", lambda e: boot.append(str(e)))
            for attempt in range(6):   # a local test server now and then drops a script while the page loads: start again
                boot.clear()
                await pg.goto(f"http://localhost:{PORT}/index.html?assets&net=bc&notut&p=sd{name}{attempt}"); await pg.wait_for_timeout(2000)
                if not boot and await pg.evaluate("() => { try { return [G, SIDES, SIDEUI, CLANS, QUESTS, TOWNS, DUNGEONS, SMITH].every(Boolean); } catch (e) { return false; } }"): break
                print(f"{name}: page didn't load fully, retrying ({boot[:2]})")
            await pg.wait_for_selector(".press", timeout=60000); await pg.click(".press")
            await pg.wait_for_selector(".mi[data-t=new]", timeout=30000); await pg.click(".mi[data-t=new]")
            try: await pg.wait_for_selector("#nm", timeout=30000)
            except Exception: await pg.screenshot(path=OUT + name + "_nonm.png"); await pg.click(".mi[data-t=new]"); await pg.wait_for_selector("#nm", timeout=60000)
            await pg.fill("#nm", "Sidetest"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
            await pg.wait_for_function("() => window.__dbg && window.__dbg.save()", timeout=60000)
            errs.extend(name + " " + e for e in boot)
            pg.on("pageerror", lambda e, n=name: errs.append(n + " " + str(e)))
            await pg.add_style_tag(content=".toast,#toast,.obtip{display:none!important}")
            async def clean(): await pg.evaluate("() => document.querySelectorAll('#modal,.modal,#xgame,.obtip,.toast,#toast,.pban').forEach(m => m.remove())")
            async def shot(fn, sel=None):
                await pg.wait_for_timeout(500)
                if sel: await pg.evaluate(f"() => document.querySelector(\"{sel}\")?.scrollIntoView({{block:'center'}})"); await pg.wait_for_timeout(300)
                await pg.screenshot(path=OUT + fn)
            async def jgo(i):
                await clean()
                await pg.evaluate(f"() => {{ const b = document.createElement('button'); b.dataset.act = 'jgo'; b.dataset.id = '{i}'; document.querySelector('#side').appendChild(b); b.click(); b.remove(); }}"); await pg.wait_for_timeout(700)
            await clean()
            res = await pg.evaluate(SETUP, style)
            ok(res is True, f"{name}: quest started at level 21, letter due ({res})")
            # 1. the courier's letter
            await pg.evaluate("() => SIDEUI.letter()"); await pg.wait_for_timeout(600)
            ok(await pg.query_selector("#modal .sletter") is not None, f"{name}: the courier's letter shows")
            ok(await pg.evaluate("() => document.querySelectorAll('#modal .sletter svg').length") >= 3, f"{name}: three emblems on the letter")
            await shot(f"{name}_1_letter.png")
            # 2. the Journal: hear Galmar out
            await jgo("quests")
            btn = await pg.query_selector("[data-act=qtalk][data-id=cw_choice]")
            ok(btn is not None, f"{name}: Journal has the recruiter button in Windhelm")
            await shot(f"{name}_2_journal.png", "[data-act=qtalk][data-id=cw_choice]")
            if btn:
                await pg.click("[data-act=qtalk][data-id=cw_choice]"); await pg.wait_for_timeout(700)
                ok(await pg.query_selector("#modal .srec [data-sact=swear]") is not None, f"{name}: the recruiter's sheet with a Swear button")
                await shot(f"{name}_3_recruiter.png")
                await pg.click("#modal [data-sact=swear]"); await pg.wait_for_timeout(800)
                side = await pg.evaluate("() => SIDES.mine(window.__dbg.save())")
                ok(side == "stormcloak", f"{name}: sworn to the Stormcloaks ({side})")
                ok(await pg.evaluate("() => !!SIDECLOAK.active(window.__dbg.save())"), f"{name}: cloak worn")
                await shot(f"{name}_4_sworn.png")
            # 3. the Faction tab: earn some rank XP first (banner), then look
            await clean()
            await pg.evaluate("() => { const S = window.__dbg.save(); SIDES.gainXp(S, 'pvp'); SIDES.gainXp(S, 'dungeon'); }"); await pg.wait_for_timeout(300)
            await jgo("faction")
            ok(await pg.query_selector(".sidep .sxp .bar") is not None, f"{name}: rank XP bar on the Faction tab")
            ok(await pg.evaluate("() => document.querySelectorAll('.sidep .scloak').length") >= 2, f"{name}: current and next cloak")
            await shot(f"{name}_5_faction.png", ".sidep")
            await shot(f"{name}_6_ladder.png", ".sidep .scloak")
            # 4. phone width: nothing scrolls sideways
            if w < 800:
                over = await pg.evaluate("() => document.documentElement.scrollWidth - innerWidth")
                ok(over <= 1, f"{name}: no sideways scroll ({over}px)")
            # 5. the hero with the cloak (inventory / character look)
            await clean()
            await pg.evaluate("() => { const b = document.querySelector('[data-tab=hero]'); if (b) b.click(); }"); await pg.wait_for_timeout(800)
            await shot(f"{name}_7_hero.png")
            await ctx.close()
        await b.close()
        ok(not errs, "no page errors " + "; ".join(errs[:5]))
    print("RESULT " + ("OK" if not fails else "FAIL " + str(len(fails))))
    sys.exit(1 if fails else 0)

asyncio.run(main())
