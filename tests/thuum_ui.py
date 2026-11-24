# Shouts + weather that matters (thuum.js, wxmatters.js): the HUD weather chip and its card, the clock tooltip,
# a storm keeping the ship in harbour at Windhelm, cooldowns with perks in Magic → Shouts, Fire Breath on the road.
# Phone (412×915) and PC (1366×800), ink and pixel; one Polish pass. Screenshots: thuum_*.png
import asyncio, os, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8851"
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
OUT = os.environ.get("OUT", ".")
FORCE = """(id)=>{ if (!window.__wx0) window.__wx0 = WEVENTS.weather; const r = window.__wx0; WEVENTS.weather = (p, t) => ({ ...r(p, t), id, name: WEVENTS.W[id][0], icon: WEVENTS.W[id][1], speed: WEVENTS.W[id][2], sneak: WEVENTS.W[id][3], encounters: WEVENTS.W[id][4] }); }"""
async def main():
    async with async_playwright() as p:
        kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if os.path.exists(CHROME) else {}
        b = await p.chromium.launch(**kw)
        bad, errs = [], []
        def ok(v, m):
            print(("ok   " if v else "FAIL ") + m)
            if not v: bad.append(m)
        runs = [("ink", 412, 915, "en"), ("pixel", 412, 915, "en"), ("ink", 1366, 800, "en"), ("ink", 412, 915, "pl")]
        for style, w, h, lang in runs:
            tag = f"{style}_{'phone' if w < 800 else 'pc'}{'_pl' if lang == 'pl' else ''}"
            ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if w < 800 else 1)
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=th{tag}")
            if lang == "pl":
                await pg.evaluate("localStorage.setItem('rotn_prefs', JSON.stringify({lang:'pl'}))"); await pg.reload()
            await pg.wait_for_timeout(1800)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Dovah"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
            await pg.evaluate(f"()=>{{ART.setStyle('{style}'); if (typeof POLISH!=='undefined') POLISH.texture();}}")
            clean = "document.querySelectorAll('#modal,#wxpop').forEach(m=>m.remove())"
            async def tab(t):
                await pg.evaluate(clean); await pg.evaluate(f"document.querySelector('[data-tab={t}]')?.click()"); await pg.wait_for_timeout(500)
            # ---- rain in the wilds near Whiterun: the chip, the tooltip, the card
            await pg.evaluate(FORCE, "rain")
            await pg.evaluate("""()=>{const S=window.__dbg.save(); S.location=null; const p=WORLD.places.Whiterun; S.x=p[0]+0.012; S.y=p[1]+0.01;}""")
            await tab("tactics"); await tab("map"); await pg.wait_for_timeout(600)
            chip = await pg.query_selector(".hstat .wxchip")
            ok(chip is not None, f"{tag}: weather chip in the HUD")
            tip = await pg.evaluate("document.querySelector('.hstat .wxchip')?.dataset.tip || ''")
            ok(tip.startswith("Rain:") and "Fire 15% weaker" in tip, f"{tag}: chip tooltip says what rain does: {tip!r}")
            ctip = await pg.evaluate("document.querySelector('#clock')?.dataset.tip || ''")
            ok(ctip == tip, f"{tag}: the clock carries the same tooltip")
            if chip:
                await pg.evaluate("document.querySelector('.hstat .wxchip').scrollIntoView({block:'center'})")
                await chip.click(); await pg.wait_for_timeout(400)
                card = await pg.evaluate("document.querySelector('#wxpop')?.innerText || ''")
                want = "Podróż" if lang == "pl" else "Travel"
                ok(want in card and len(card.splitlines()) >= 4, f"{tag}: tapping the chip opens the card: {card[:120]!r}")
                await pg.screenshot(path=os.path.join(OUT, f"thuum_wxcard_{tag}.png"))
                await pg.mouse.click(5, h - 5); await pg.wait_for_timeout(300)
                ok(await pg.query_selector("#wxpop") is None, f"{tag}: tapping elsewhere closes the card")
            # ---- a storm at Windhelm's docks: no sailing
            await pg.evaluate(FORCE, "storm")
            await pg.evaluate("""()=>{const S=window.__dbg.save(); S.trip=null; S.location='Windhelm'; const p=WORLD.places.Windhelm; S.x=p[0]; S.y=p[1]; S.gold=2000;}""")
            await tab("town"); await pg.evaluate("document.querySelector('[data-act=shop][data-id=docks]')?.click()"); await pg.wait_for_timeout(500)
            sail = await pg.query_selector("[data-act=sail]")
            ok(sail is not None and await sail.is_disabled(), f"{tag}: Sail is greyed out in a storm")
            note = await pg.evaluate("(document.querySelector('[data-act=sail]')?.closest('.panel,#modal,section,div.card') || document.body).textContent")
            ok(("lashes the coast" in note) or (lang == "pl" and "wybrzeże" in note), f"{tag}: the docks say why: {note[:300]!r}")
            if sail:
                await sail.scroll_into_view_if_needed(); await pg.screenshot(path=os.path.join(OUT, f"thuum_docks_storm_{tag}.png"))
            # ---- Magic → Shouts: cooldown with Commanding Voice + Thu'um Mastery 2, and Fire Breath on the road
            await pg.evaluate("""()=>{const S=window.__dbg.save(); S.location=null; const p=WORLD.places.Winterhold; S.x=p[0]+0.01; S.y=p[1]+0.01; S.souls=1;
                for (const id of ['fire_breath','slow_time']) for (const w of POWERS.SHOUTS[id][1]) { POWERS.learnWord(S,w); S.unlocked=[...new Set([...(S.unlocked||[]),w])]; }
                S.perks=Object.assign(S.perks||{}, {commanding_voice:1, thuum_mastery:2}); S.voiceAt=0; S.coldV=70; S.coldT=G.now(); }""")
            await pg.evaluate(FORCE, "blizzard")
            await tab("pack"); await pg.evaluate("document.querySelector('[data-act=skytab][data-id=magic]')?.click()"); await pg.wait_for_timeout(300)
            await pg.evaluate(clean); await pg.evaluate("document.querySelector('#sky .sky-cat[data-id=shouts]')?.click()"); await pg.wait_for_timeout(300)
            rows = await pg.evaluate("[...document.querySelectorAll('#sky .sky-row')].map(b=>b.textContent.trim())")
            idx = next((i for i, t in enumerate(rows) if "Slow Time" in t), -1)
            if idx >= 0:
                await pg.click(f"#sky .sky-row >> nth={idx}"); await pg.wait_for_timeout(300)
                det = await pg.inner_text("#sky .sky-detail")
                ok("39" in det, f"{tag}: Slow Time shows the perk cooldown (39 s): {det[-90:]!r}")
            else: ok(False, f"{tag}: Slow Time row")
            idx = next((i for i, t in enumerate(rows) if "Fire Breath" in t), -1)
            if idx >= 0:
                await pg.click(f"#sky .sky-row >> nth={idx}"); await pg.wait_for_timeout(300)
                btn = await pg.query_selector("#sky .sky-detail [data-act=roadshout]")
                ok(btn is not None, f"{tag}: Fire Breath has a 'Shout now' button")
                await pg.screenshot(path=os.path.join(OUT, f"thuum_shouts_{tag}.png"))
                if btn:
                    await btn.click(); await pg.wait_for_timeout(500)
                    cold = await pg.evaluate("window.__dbg.save().coldV")
                    ok(cold < 30, f"{tag}: Fire Breath warmed you up (cold {cold})")
            else: ok(False, f"{tag}: Fire Breath row")
            await ctx.close()
        print("errors:", errs)
        print("RESULT", "OK" if not bad and not errs else f"FAIL {len(bad)}")
        await b.close()
        sys.exit(1 if bad or errs else 0)
asyncio.run(main())
