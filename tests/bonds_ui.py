"""Follower and horse bonds (bonds.js) in the browser: phone (390x844) and PC (1920x1080), ink and pixel art.
Usage: python bonds_ui.py PORT [OUTDIR] -> RESULT OK
Hires Lydia at Trusted rank, opens Hero -> Follower -> Bond (rank ladder), then buys a horse at Whiterun's stables,
raises its bond to level 3, shows the bond card with the five specialities, picks Warhorse with a tap.
LANG_UI=pl runs it in Polish. Screenshots: OUTDIR (default tests/out_bonds/) as bonds_<view>_<tag>.png."""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = (sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_bonds")).rstrip("/\\") + os.sep
os.makedirs(OUT, exist_ok=True)
LANG = os.environ.get("LANG_UI", "en")
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

SETUP = """() => { const S = window.__dbg.save(); S.gold = 9000; S.level = 20; S.thaneWhiterun = true; G.shopsOpen = () => true;
  S.trip = null; S.dungeon = null; S.location = 'Whiterun'; [S.x, S.y] = WORLD.places.Whiterun; if (!S.follower) TOWNS.hire(S, 'lydia');
  const f = FOL2.st(S); f.loyal = 58; BONDS2.rankCheck(S); f.loyal = 66; BONDS2.rankCheck(S); BONDS2.roadTime(S, 600, G.now());
  G.setHealth(S, G.maxHealth(S)); window.__dbg.publish?.(); return S.follower.id + ':' + BONDS.loyalty(S) + ':' + BONDS2.rank(S); }"""

async def main():
    async with async_playwright() as p:
        kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if os.path.exists(CHROME) else {}
        b = await p.chromium.launch(**kw)
        errs = []
        for vw, vh, tag, style in [(390, 844, "phone", "ink"), (1920, 1080, "pc", "ink"), (390, 844, "phone", "pixel")]:
            name = f"{tag}_{style}" + ("" if LANG == "en" else "_" + LANG)
            ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=2 if tag == "phone" else 1, has_touch=tag == "phone")
            await ctx.add_init_script(f"localStorage.setItem('rotn_prefs', JSON.stringify({{artStyle:'{style}',obTips:false,lang:'{LANG}'}}))")
            pg = await ctx.new_page(); pg.on("pageerror", lambda e, n=name: errs.append(n + " " + str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=bd{name}"); await pg.wait_for_timeout(2000)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Bondtest"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
            res = await pg.evaluate(SETUP)
            ok(res.endswith(":2"), f"{name}: Lydia hired at Trusted rank ({res})")
            async def clean(): await pg.evaluate("() => document.querySelectorAll('#modal,.modal,#xgame,.obtip,.toast,#toast,.pban,#folbark,#bark').forEach(m => m.remove())")
            async def tap(sel):
                for _ in range(5):
                    try:
                        await clean(); await pg.click(sel, timeout=4000); await pg.wait_for_timeout(400); return True
                    except Exception: await pg.wait_for_timeout(300)
                return False
            async def shot(sel, fn):
                await clean(); await pg.wait_for_timeout(300)
                await pg.evaluate(f"() => document.querySelector('{sel}')?.scrollIntoView({{block: 'center'}})"); await pg.wait_for_timeout(300)
                await pg.screenshot(path=OUT + fn); return True
            # --- the Bond tab with the rank ladder
            if not await tap("[data-tab=hero]"):
                await pg.evaluate("() => document.querySelector('[data-tab=hero]')?.click()")
            await pg.evaluate("() => window.__ui.go('follower')"); await pg.wait_for_timeout(400)
            ok(await tap(".fol2 [data-op=view][data-id=bond]"), f"{name}: open the Bond tab")
            txt = await pg.evaluate("document.querySelector('.bondranks')?.textContent || ''")
            want = ["Trusted", "Companion", "Sworn"] if LANG == "en" else ["Zaufany", "Kompan", "Zaprzysiężony"]
            ok(all(w in txt for w in want), f"{name}: rank ladder shows the ranks")
            over = await pg.evaluate("() => { const r = document.querySelector('.bondrks'); if (!r) return 'none'; return [...r.children].filter(c => c.scrollWidth > c.clientWidth + 2 || c.getBoundingClientRect().right > innerWidth + 1).length; }")
            ok(over == 0, f"{name}: rank ladder fits the screen ({over})")
            await shot(".bondranks", f"bonds_follower_{name}.png")
            # --- the stables: buy a horse, bond to 3, the speciality list, pick Warhorse
            await pg.evaluate("() => document.querySelector('#pcclose')?.click()"); await pg.wait_for_timeout(400)
            await pg.evaluate("() => window.__ui.go('town')"); await pg.wait_for_timeout(400); await tap("[data-id=stables]")
            await pg.evaluate("() => { const S = window.__dbg.save(); HORSES.buy(S, 'Juniper', 'chestnut', 'bay'); BONDS2.hgain(S, 104); }")
            await tap("[data-id=stables]"); await pg.wait_for_timeout(300)
            n = await pg.evaluate("document.querySelectorAll('.hsp').length")
            ok(n == 5, f"{name}: five specialities at the stables ({n})")
            ok(await tap(".hsp [data-op=hbond][data-id=warhorse]"), f"{name}: tap Choose on Warhorse")
            spec = await pg.evaluate("() => BONDS2.spec(window.__dbg.save())")
            ok(spec == "warhorse", f"{name}: the horse is now a warhorse ({spec})")
            fit = await pg.evaluate("() => [...document.querySelectorAll('.hsp')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).length")
            ok(fit == 0, f"{name}: speciality rows fit the screen")
            await shot(".hbond", f"bonds_horse_{name}.png")
            await ctx.close()
        ok(not errs, "no page errors " + str(errs[:3]))
        await b.close()
    print("RESULT", "OK" if not fails else "FAIL " + str(len(fails)))
asyncio.run(main())
