"""The Dwemer deep-dive (dwemer.js, blackreach.js) in the browser: phone (390x844) and PC (1280x800), ink and pixel
(LANG_UI=pl for Polish). Usage: python dwemer_ui.py PORT -> RESULT OK
Turns the lexicon's rings with Calcelmo from the Journal (and checks the quest moves on), rides the great lift down from
Alftand, walks the Blackreach map, works the Silent City vault's valves, reads the lexicon at the Tower of Mzark, and
steps into the Great Dynamo (the fight screen opens). Screenshots: tests/out_dwemer/."""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
LANG = os.environ.get("LANG_UI", "en")
WORDS = {"en": ["The Dwemer Lexicon", "Blackreach"], "pl": ["Leksykon Dwemerów", "Czarna Otchłań"]}[LANG]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_dwemer") + os.sep; os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

SETUP = """(st) => { ART.setStyle(st); const S = window.__dbg.save(); S.gold = 5000; S.level = 26; S.trip = null; S.dungeon = null;
  S.quests = S.quests || {}; S.quests.dw_lexicon = { stage: DWEMER.STAGE.lexicon, t: G.now() }; G.give(S, 'dwemer_lexicon'); S.trackQ = 'dw_lexicon';
  S.location = 'Markarth'; [S.x, S.y] = WORLD.places['Markarth']; S.discovered = [...new Set([...(S.discovered || []), 'Markarth', 'Alftand', 'Raldbthar', 'Mzinchaleft'])];
  G.setHealth(S, G.maxHealth(S)); window.__dbg.publish(); return QUESTS.L.dw_lexicon.stages[S.quests.dw_lexicon.stage].title; }"""
SOLVE = """async () => { const ov = DWEMER.ov; if (!ov) return 'no puzzle';
  for (const i of DWEMER.solve(ov.pz, ov.pz.pos)) { document.querySelector(`#dwgame [data-dw=turn][data-i="${i}"]`).click(); await new Promise((r) => setTimeout(r, 120)); }
  return ov.pz.done || 'open'; }"""

async def main():
    async with async_playwright() as p:
        kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if os.path.exists(CHROME) else {}
        b = await p.chromium.launch(**kw)
        errs = []
        for style, dev in [("ink", "phone"), ("pixel", "phone"), ("ink", "pc")]:
            name = f"{dev}_{style}" + ("" if LANG == "en" else "_" + LANG)
            vp = {"width": 390, "height": 844} if dev == "phone" else {"width": 1280, "height": 800}
            ctx = await b.new_context(viewport=vp, device_scale_factor=2 if dev == "phone" else 1, has_touch=dev == "phone")
            await ctx.add_init_script(f"localStorage.setItem('rotn_prefs', JSON.stringify({{artStyle:'{style}',obTips:false,lang:'{LANG}'}}))")
            pg = await ctx.new_page(); pg.on("pageerror", lambda e, n=name: errs.append(n + " " + str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=dw{name}"); await pg.wait_for_timeout(2000)
            try: await pg.wait_for_selector(".press", timeout=60000)
            except Exception: await pg.reload(); await pg.wait_for_selector(".press", timeout=120000)   # a busy machine: one more go
            await pg.click(".press")
            await pg.wait_for_selector(".mi[data-t=new]", timeout=30000); await pg.click(".mi[data-t=new]")
            await pg.wait_for_selector("#nm", timeout=30000); await pg.fill("#nm", "Dwemtest"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
            await pg.add_style_tag(content="#pbanners,.pban,.pburst,.pgold,.toast,#toast{display:none!important}")   # other systems' banners, not ours
            res = await pg.evaluate(SETUP, style)
            ok(res == "Reading the Lexicon", f"{name}: at the lexicon stage ({res})")
            async def clean(): await pg.evaluate("() => document.querySelectorAll('#modal,.modal,#xgame,.obtip,.toast,#toast,.pban').forEach(m => m.remove())")
            async def tab(t):
                await clean()
                await pg.evaluate(f"() => {{ const b = document.querySelector('[data-tab={t}]'); if (b) b.click(); }}"); await pg.wait_for_timeout(600)
            async def shot(fn, sel=None):
                await pg.wait_for_timeout(500)
                if sel: await pg.evaluate(f"() => document.querySelector(\"{sel}\")?.scrollIntoView({{block:'center'}})"); await pg.wait_for_timeout(300)
                await pg.screenshot(path=OUT + fn)
            # 1. the Journal: the lexicon from Calcelmo's quest card
            await tab("log")
            txt = await pg.evaluate("document.body.innerText")
            ok(WORDS[0] in txt, f"{name}: the line is in the Journal")
            ok(await pg.query_selector("[data-act=qtalk][data-id=dw_lexicon]") is not None, f"{name}: Turn the lexicon button on the quest card")
            await shot(f"{name}_journal.png", "[data-act=qtalk][data-id=dw_lexicon]")
            await pg.evaluate("() => document.querySelector('[data-act=qtalk][data-id=dw_lexicon]')?.click()"); await pg.wait_for_timeout(900)
            await pg.evaluate("() => document.querySelectorAll('#modal,.modal').forEach(m => m.remove())")
            ok(await pg.query_selector("#dwgame .dw-ring") is not None, f"{name}: the lexicon's rings open")
            await shot(f"{name}_lexicon.png")
            done = await pg.evaluate(SOLVE)
            ok(done == "solved", f"{name}: rings lined up ({done})")
            await shot(f"{name}_lexicon_solved.png")
            await pg.click("#dwgame [data-dw=done]"); await pg.wait_for_timeout(900)
            st = await pg.evaluate("() => window.__dbg.save().quests.dw_lexicon.stage")
            ok(st == 4, f"{name}: the quest moved on to the great lift ({st})")
            await shot(f"{name}_lexicon_read.png")
            # 2. Alftand: the way down (fight on the lift skipped: straight to the Tower stage)
            await pg.evaluate("""() => { const S = window.__dbg.save(); S.quests.dw_lexicon.stage = DWEMER.STAGE.mzark; DWEMER.sync(S);
              S.location = 'Alftand'; [S.x, S.y] = WORLD.places['Alftand']; S.reach = { at: null, cleared: { warren: G.now(), city: G.now() } }; window.__dbg.publish(); }""")
            await tab("map")
            try: await pg.wait_for_selector("[data-act=breach][data-k=enter]", state="attached", timeout=20000)
            except Exception: pass
            card = await pg.query_selector("[data-act=breach][data-k=enter]")
            ok(card is not None, f"{name}: Blackreach card at Alftand")
            await shot(f"{name}_alftand.png", "[data-act=breach][data-k=enter]")
            await pg.evaluate("() => document.querySelector('[data-act=breach][data-k=enter]')?.click()")
            try: await pg.wait_for_selector("#breach .br-pin.here", state="attached", timeout=20000)
            except Exception: pass
            ok(await pg.query_selector("#breach .br-map img") is not None and await pg.query_selector("#breach .br-pin.here") is not None, f"{name}: the Blackreach map with you at the lift")
            ok(WORDS[1].lower() in (await pg.evaluate("document.querySelector('#breach')?.innerText || ''")).lower(), f"{name}: Blackreach heading")
            await shot(f"{name}_reach_lift.png")
            # 3. walk: warren, city (both cleared), the vault
            for k in ["warren", "city"]:
                await pg.evaluate(f"() => document.querySelector('#breach .br-pin[data-id={k}]')?.click()"); await pg.wait_for_timeout(500)
            at = await pg.evaluate("() => BLACKREACH.here(window.__dbg.save())")
            ok(at == "city", f"{name}: walked to the Silent City ({at})")
            await shot(f"{name}_reach_city.png")
            await pg.evaluate("() => document.querySelector('#breach [data-k=vault]')?.click()")
            try: await pg.wait_for_selector("#dwgame .dw-valve", state="attached", timeout=20000)
            except Exception: pass
            ok(await pg.query_selector("#dwgame .dw-valve") is not None, f"{name}: the vault's valves open")
            await shot(f"{name}_vault_valves.png")
            g0 = await pg.evaluate("() => window.__dbg.save().gold")
            done = await pg.evaluate(SOLVE)
            ok(done == "solved", f"{name}: valves solved ({done})")
            await pg.click("#dwgame [data-dw=done]", timeout=20000); await pg.wait_for_timeout(600)
            g1 = await pg.evaluate("() => window.__dbg.save().gold")
            ok(g1 > g0, f"{name}: the vault paid out ({g0} -> {g1})")
            # 4. the Tower of Mzark: the lexicon is read, the dynamo door opens
            await pg.evaluate("() => document.querySelector('#breach .br-pin[data-id=mzark]')?.click()"); await pg.wait_for_timeout(900)
            f = await pg.evaluate("() => [!!window.__dbg.save().dwMzark, window.__dbg.save().quests.dw_lexicon.stage]")
            ok(f[0] and f[1] == 6, f"{name}: lexicon read at Mzark, quest on to the Centurion ({f})")
            await shot(f"{name}_mzark.png")
            await pg.evaluate("() => document.querySelectorAll('#modal,.modal').forEach(m => m.remove())")
            await shot(f"{name}_reach_mzark_map.png")
            over = await pg.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
            ok(over <= 1, f"{name}: no sideways scroll ({over})")
            # 5. into the Great Dynamo: the fight screen opens
            await pg.evaluate("() => document.querySelector('#breach .br-pin[data-id=dynamo]')?.click()"); await pg.wait_for_timeout(1500)
            ok(await pg.query_selector("#tbf, #modal") is not None, f"{name}: the Centurion master fight (fight screen or its result)")
            await shot(f"{name}_centurion_fight.png")
            await ctx.close()
        ok(not errs, "no page errors: " + "; ".join(errs[:3]))
        await b.close()
    print("RESULT", "OK" if not fails else "FAIL " + str(len(fails)))
asyncio.run(main())
