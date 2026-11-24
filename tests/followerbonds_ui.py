"""Followers become people (followerbonds.js) in the browser: phone (390x844) and PC (1920x1080), ink and pixel.
Usage: python followerbonds_ui.py PORT -> RESULT OK
Hires Lydia, makes a few road choices she reacts to, opens Hero -> Follower -> Bond (meter, likes, log), opens her
personal quest at high loyalty, walks it to the last choice, picks one, and shows her speech bubble on the map.
Screenshots: tests/out_followerbonds/."""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
LANG = os.environ.get("LANG_UI", "en")   # LANG_UI=pl runs the same walk with the game in Polish
WORDS = {"en": ["Likes", "Dislikes", "Personal quest", "Lydia"], "pl": ["Lubi", "Nie lubi", "Osobiste zadanie", "Lydia", "Lojalność"]}[LANG]
OUT =os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_followerbonds") + os.sep; os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

SETUP = """(st) => { ART.setStyle(st); const S = window.__dbg.save(); S.gold = 5000; S.level = 20; S.thaneWhiterun = true;
  S.trip = null; S.dungeon = null; S.location = 'Whiterun'; [S.x, S.y] = WORLD.places.Whiterun; if (!S.follower) TOWNS.hire(S, 'lydia');
  const ev = (id, c) => { G.startTrip(S, 'Riverwood', WORLD.places.Riverwood.slice(0, 2)); S.trip.status = 'event'; S.trip.event = { id, purse: 20 }; G.eventChoice(S, c); S.trip = null; S.dungeon = null; };
  ev('sleeper', 'leave'); ev('lost', 'walk'); ev('injured', 'leave'); ev('dragonfly', 'fight');
  S.trip = null; S.dungeon = null; S.location = 'Whiterun'; [S.x, S.y] = WORLD.places.Whiterun; G.setHealth(S, G.maxHealth(S));
  window.__dbg.publish(); return S.follower ? S.follower.id + ':' + BONDS.loyalty(S) : 'none'; }"""

async def main():
    async with async_playwright() as p:
        kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if os.path.exists(CHROME) else {}
        b = await p.chromium.launch(**kw)
        errs = []
        for vw, vh, tag in [(390, 844, "phone"), (1920, 1080, "pc")]:
            for style in ["ink", "pixel"]:
                name = f"{tag}_{style}" + ("" if LANG == "en" else "_" + LANG)
                ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=2 if tag == "phone" else 1, has_touch=tag == "phone")
                await ctx.add_init_script(f"localStorage.setItem('rotn_prefs', JSON.stringify({{artStyle:'{style}',obTips:false,lang:'{LANG}'}}))")
                pg = await ctx.new_page(); pg.on("pageerror", lambda e, n=name: errs.append(n + " " + str(e)))
                await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=fb{name}"); await pg.wait_for_timeout(2000)
                await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Bondtest"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
                res = await pg.evaluate(SETUP, style)
                ok(res.startswith("lydia:"), f"{name}: hired Lydia and made choices ({res})")
                async def clean(): await pg.evaluate("() => document.querySelectorAll('#modal,.modal,#xgame,.obtip').forEach(m => m.remove())")
                async def tap(sel):
                    for _ in range(5):
                        try:
                            await clean(); await pg.click(sel, timeout=4000); await pg.wait_for_timeout(400); return True
                        except Exception: await pg.wait_for_timeout(300)
                    return False
                async def snap(sel, fn):
                    await pg.evaluate("() => document.querySelectorAll('.toast,#toast,.pban,[class*=toast],#modal,.modal,#xgame,#folbark,#bark').forEach(e => e.remove())")
                    for _ in range(4):
                        try:
                            await pg.wait_for_timeout(400)
                            await pg.evaluate(f"() => document.querySelector('{sel}')?.scrollIntoView()")
                            el = await pg.query_selector(sel)
                            if el: await el.screenshot(path=OUT + fn, timeout=6000); return True
                        except Exception: pass
                    return False
                async def hero():
                    if not await tap("[data-tab=hero]"):
                        await pg.evaluate("() => { const b = document.querySelector('[data-tab=hero]'); if (b) b.click(); }"); await pg.wait_for_timeout(400)
                    await pg.evaluate("() => window.__ui.go('follower')"); await pg.wait_for_timeout(400)   # followertab.js
                await hero()
                ok(await pg.query_selector(".fol2 .bondm") is not None, f"{name}: loyalty meter under her name")
                ok(await tap(".fol2 [data-op=view][data-id=bond]"), f"{name}: open the Bond tab")
                txt = await pg.evaluate("document.querySelector('.fol2 .bond')?.textContent || ''")
                ok(all(w in txt for w in WORDS), f"{name}: Bond tab shows opinions, quest and what she said")
                if LANG == "pl":
                    eng = [w for w in ["Likes:", "Dislikes:", "Personal quest", "Lately", "What they think", "Loyalty", "Talk"] if w in txt]
                    ok(not eng, f"{name}: no English left on the Bond tab {eng}")
                ok(await snap(".fol2", f"{name}_bond.png"), f"{name}: Bond tab shot")
                # talk button works
                l0 = await pg.evaluate("() => BONDS.loyalty(window.__dbg.save())")
                await tap(".fol2 [data-b=talk]")
                l1 = await pg.evaluate("() => BONDS.loyalty(window.__dbg.save())")
                ok(l1 > l0, f"{name}: Talk raises loyalty ({l0} -> {l1})")
                # personal quest: open at high loyalty, walk it to the last choice
                await pg.evaluate("() => { const S = window.__dbg.save(); FOL2.st(S).loyal = 86; S.location = 'Riverwood'; }")
                await tap(".fol2 [data-op=view][data-id=card]"); await tap(".fol2 [data-op=view][data-id=bond]")
                ok(await tap(".fol2 [data-b=qstart]"), f"{name}: Listen opens her quest")
                await pg.evaluate("() => { const S = window.__dbg.save(); S.location = 'Whiterun'; BONDS.observe(S); S.cleared = { \"Dustman's Cairn\": G.now() + 5 }; BONDS.observe(S); }")
                await tap(".fol2 [data-op=view][data-id=card]"); await tap(".fol2 [data-op=view][data-id=bond]")
                ok(await pg.query_selector(".fol2 [data-b=qchoose]") is not None, f"{name}: last choice buttons show")
                ok(await snap(".fol2 .bondq", f"{name}_quest_choice.png"), f"{name}: quest choice shot")
                await tap(".fol2 [data-b=qchoose][data-i='1']")
                done = await pg.evaluate("() => BONDS.questState(window.__dbg.save()).k")
                ok(done == "done", f"{name}: quest finished ({done})")
                ok(await snap(".fol2", f"{name}_bond_done.png"), f"{name}: finished quest shot")
                # her speech bubble over the map
                await clean()
                await pg.evaluate("() => { document.querySelector('[data-tab=map]')?.click(); }"); await pg.wait_for_timeout(500)
                await pg.evaluate("() => { const S = window.__dbg.save(); BONDS.say(S, 'Keep your eyes on the treeline. Bandits love this stretch.', { mood: 'force' }); }")
                await pg.wait_for_timeout(500)
                ok(await pg.query_selector("#folbark") is not None, f"{name}: speech bubble shows")
                if LANG == "pl":
                    bt = await pg.evaluate("document.querySelector('#folbark')?.textContent || ''")
                    ok("Miej oko" in bt, f"{name}: the bubble speaks Polish ({bt[:50]})")
                await pg.screenshot(path=OUT + f"{name}_bubble.png")
                # no sideways scroll on the follower screen
                over = await pg.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
                who = "" if over <= 1 else await pg.evaluate("() => [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).slice(0, 4).map(e => (e.id || e.tagName) + '.' + String(e.className).slice(0, 30)).join(', ')")
                ok(over <= 1, f"{name}: no sideways scroll ({over}) {who}")
                await ctx.close()
        ok(not errs, "no page errors: " + "; ".join(errs[:3]))
        await b.close()
    print("RESULT", "OK" if not fails else "FAIL " + str(len(fails)))
asyncio.run(main())
