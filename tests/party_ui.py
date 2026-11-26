import asyncio, sys
from playwright.async_api import async_playwright
_SHOTS = (__import__("os").environ.get("SHOTS") or __import__("os").path.join(__import__("tempfile").gettempdir(), "rotn_shots")).replace("\\", "/").rstrip("/") + "/"   # screenshots: $SHOTS or the temp folder
__import__("os").makedirs(_SHOTS, exist_ok=True)
PORT = sys.argv[1] if len(sys.argv) > 1 else "8835"
SHOT = _SHOTS + "party_"
GEAR_B = """() => { const S = window.__dbg.save(); for (const id of ['steel_sword','steel_armor','steel_helmet','steel_shield']) { if (!D.ITEMS[id]) continue; G.give(S, id); const r = S.inv.find(x => x.item === id); try { G.equip(S, r.id); } catch (e) {} } }"""
GEAR_A = """() => { const S = window.__dbg.save(); for (const id of ['iron_war_axe','leather_armor','hide_helmet']) { if (!D.ITEMS[id]) continue; G.give(S, id); const r = S.inv.find(x => x.item === id); try { G.equip(S, r.id); } catch (e) {} } }"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        errs = []; ok = True
        for style in ["ink"]:
            ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2)
            await ctx.add_init_script(f"localStorage.setItem('rotn_prefs', JSON.stringify({{artStyle:'{style}'}}))")
            async def phone(tag, name):
                pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(style + " " + tag + " " + str(e)))
                await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&fightanim&p=pt{style}{tag}"); await pg.wait_for_timeout(1800)
                await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1200)
                await pg.evaluate("() => document.querySelectorAll('#modal,.modal').forEach(m => m.remove())")
                return pg
            async def clean(pg): await pg.evaluate("() => document.querySelectorAll('#modal,.modal,#xgame').forEach(m => m.remove())")
            A = await phone("a", "Alfa"); B = await phone("b", "Beta")
            here = "() => { const S = window.__dbg.save(); S.location = 'Whiterun'; [S.x, S.y] = WORLD.places.Whiterun; S.trip = null; S.level = 12; S.hpBonus = 80; G.setHealth(S, G.maxHealth(S)); }"
            for pg in (A, B): await pg.evaluate(here)
            await A.evaluate(GEAR_A); await B.evaluate(GEAR_B)
            await B.evaluate("() => { const S = window.__dbg.save(); S.gold = 5000; HORSES.buy(S, 'Juniper', 'palomino'); }")
            ida = await A.evaluate("window.__dbg.save().id"); idb = await B.evaluate("window.__dbg.save().id")
            await A.evaluate(f"() => Store.put('parties', 'pt{style}', {{ leader: '{ida}', leaderName: 'Alfa', members: [{{ id: '{ida}', name: 'Alfa' }}, {{ id: '{idb}', name: 'Beta' }}], invites: [], t: G.now() }})")
            await A.wait_for_timeout(1200)
            # both set off for Riverwood together; B rides
            trip = "() => { const S = window.__dbg.save(); S.location = null; G.startTrip(S, 'Riverwood', WORLD.places.Riverwood.slice(0, 2)); window.__dbg.publish(); }"
            await B.evaluate("() => { const S = window.__dbg.save(); if (HORSES.present(S) && !HORSES.riding(S)) HORSES.toggleRide?.(S); }")
            await A.evaluate(trip); await B.evaluate(trip)
            for _ in range(10):
                await A.wait_for_timeout(700)
                pa = await A.evaluate("() => !!window.__dbg.party() && window.__dbg.others().some(o => o.name === 'Beta' && o.look && o.pp)")
                pb = await B.evaluate("() => !!window.__dbg.party() && window.__dbg.others().some(o => o.name === 'Alfa')")
                if pa and pb: break
            print(style, "party seen:", pa, pb)
            ok = ok and pa and pb
            for pg, nm in ((A, "a"), (B, "b")):
                await clean(pg); await pg.click("[data-tab=world]"); await pg.wait_for_timeout(1500)
                v = await pg.query_selector("#fpt .fpt-view canvas")
                if v: await v.screenshot(path=f"{SHOT}{style}_travel_{nm}.png")
                else: print(style, nm, "no travel picture"); ok = False
            # a road encounter on A's side; B stops right beside A
            await B.evaluate("() => { const S = window.__dbg.save(); }")
            posA = await A.evaluate("() => { const S = window.__dbg.save(); const p = G.posAfter ? G.posAfter(S, 0) : [S.x, S.y]; return [S.x, S.y]; }")
            await B.evaluate(f"() => {{ const S = window.__dbg.save(); S.trip = null; S.location = null; S.x = {posA[0]}; S.y = {posA[1]}; window.__dbg.publish(); }}")
            await A.evaluate("""() => { const S = window.__dbg.save(); const base = D.ENCOUNTERS.find(e => e.name === 'Bandit outlaw') || D.ENCOUNTERS[0];
                S.trip.status = 'encounter'; S.trip.encounter = { ...G.scaleEnemy(base, S.level), hold: 'Whiterun', danger: base.danger }; window.__dbg.publish(); }""")
            await A.wait_for_timeout(1800)
            near = await A.evaluate("() => { const S = window.__dbg.save(); const o = window.__dbg.others().find(o => o.name === 'Beta'); return o ? G.pxDist([o.x, o.y], [S.x, S.y]) : -1 }")
            print(style, "Beta distance:", near)
            gold0 = await B.evaluate("window.__dbg.save().gold")
            await clean(A); await A.click("[data-tab=world]"); await A.wait_for_timeout(400)
            if await A.query_selector("[data-act=openenc]"): await A.click("[data-act=openenc]")
            await A.wait_for_timeout(400)
            await A.click("[data-act=enc][data-a=fight]"); await A.wait_for_timeout(1600)
            el = await A.query_selector("#modal .fscene")
            log = await A.evaluate("[...document.querySelectorAll('#modal .flog div')].map(d=>d.textContent).join(' | ')")
            fought = "Beta" in log
            print(style, "Beta in A's fight:", fought, "|", log[:200])
            ok = ok and fought
            if el:
                await el.screenshot(path=f"{SHOT}{style}_fight.png")
                await A.wait_for_timeout(2500); await el.screenshot(path=f"{SHOT}{style}_fight2.png")
            won = await A.evaluate("() => /Victory/.test(document.querySelector('#modal h2')?.textContent || '')")
            print(style, "won:", won)
            # B takes their share once
            got = False
            for _ in range(12):
                await B.wait_for_timeout(700)
                g1 = await B.evaluate("window.__dbg.save().gold"); sh = await B.evaluate("Object.keys(window.__dbg.save().pshares || {}).length")
                if sh: got = True; break
            print(style, "B share:", got, gold0, "->", g1)
            if won: ok = ok and got
            # a second look: the share can't be taken twice
            await B.wait_for_timeout(1500)
            sh2 = await B.evaluate("Object.keys(window.__dbg.save().pshares || {}).length")
            g2 = await B.evaluate("window.__dbg.save().gold")
            print(style, "after wait:", sh2, g2)
            if won: ok = ok and sh2 == 1 and g2 == g1
            await ctx.close()
        print("errors:", errs)
        print("RESULT", "OK" if ok and not errs else "FAIL")
        await b.close()
asyncio.run(main())
