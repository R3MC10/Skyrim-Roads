"""Followers: Hero tab panel (overview, pack with give/equip, skills & perks), and two phones in a party seeing each
other's followers in the travel picture and fighting beside them. python3 followers2_ui.py <port>  -> RESULT OK"""
import asyncio, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8852"
SHOT = "/home/claude/tests/fol2_"
HIRE = """(id) => { const S = window.__dbg.save(); S.gold = 5000; S.thaneWhiterun = true; S.location = 'Whiterun'; [S.x, S.y] = WORLD.places.Whiterun; S.trip = null; S.level = 14; S.hpBonus = 80; G.setHealth(S, G.maxHealth(S));
  const home = TOWNS.FOLLOWERS[id][1]; S.location = home; const m = TOWNS.hire(S, id); S.location = 'Whiterun'; window.__dbg.publish(); return m; }"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None), args=["--no-sandbox"])
        errs = []; ok = True
        def check(cond, msg):
            nonlocal ok
            print(("ok  " if cond else "FAIL") + " " + msg); ok = ok and bool(cond)
        for style in ["ink", "pixel"]:
            ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2)
            await ctx.add_init_script(f"localStorage.setItem('rotn_prefs', JSON.stringify({{artStyle:'{style}'}}))")
            async def phone(tag, name):
                pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(style + " " + tag + " " + str(e)))
                await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&fightanim&p=fl{style}{tag}"); await pg.wait_for_timeout(1800)
                await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1200)
                await pg.evaluate("() => document.querySelectorAll('#modal,.modal').forEach(m => m.remove())")
                return pg
            async def snap(pg, sel, path):
                for _ in range(3):
                    try:
                        el = await pg.query_selector(sel)
                        if el: await el.screenshot(path=path, timeout=8000); return True
                    except Exception: await pg.wait_for_timeout(400)
                return False
            async def clean(pg): await pg.evaluate("() => document.querySelectorAll('#modal,.modal,#xgame').forEach(m => m.remove())")
            async def tap(pg, sel):
                for _ in range(5):
                    try:
                        await clean(pg); await pg.click(sel, timeout=4000); return True
                    except Exception: await pg.wait_for_timeout(300)
                return False
            A = await phone("a", "Alfa"); B = await phone("b", "Beta")
            print(style, await A.evaluate(HIRE, "lydia"), "|", await B.evaluate(HIRE, "jenassa"))
            # ---- the follower panel on A
            await tap(A, "[data-tab=hero]"); await A.wait_for_timeout(500)
            await A.evaluate("() => window.__ui.go('follower')"); await A.wait_for_timeout(400)   # followertab.js: own tab
            await A.evaluate("() => document.querySelector('.fol2')?.scrollIntoView()")
            pan = await A.query_selector(".fol2")
            check(pan, style + " follower panel on the Hero tab")
            await snap(A, ".fol2", f"{SHOT}{style}_card.png")
            txt = await A.evaluate("document.querySelector('.fol2')?.textContent || ''")
            check("Lydia" in txt and "Warrior" in txt and "Lv" in txt, style + " shows name, style and level")
            # give a sword from A's pack and equip it
            await A.evaluate("() => { const S = window.__dbg.save(); G.give(S, 'iron_greatsword'); G.give(S, 'potion_health', 2); }")
            await tap(A, ".fol2 [data-op=view][data-id=inv]"); await A.wait_for_timeout(300)
            await tap(A, ".fol2 [data-op=ftside][data-id=yours]"); await A.wait_for_timeout(300)
            rows = await A.evaluate("[...document.querySelectorAll('.fol2 .ft-list .sky-row')].map(r => r.textContent)")
            check(any("Greatsword" in r for r in rows), style + " your pack lists things to give")
            row = await A.query_selector(".fol2 .ft-list .sky-row:has-text('Iron Greatsword')")
            if row: await clean(A); await row.click(); await A.wait_for_timeout(300)
            await tap(A, ".fol2 .ft-detail [data-op=give]"); await A.wait_for_timeout(300)
            has = await A.evaluate("() => FOL2.st(window.__dbg.save()).inv.some(r => r.item === 'iron_greatsword')")
            check(has, style + " gave the greatsword")
            await tap(A, ".fol2 [data-op=ftside][data-id=theirs]"); await A.wait_for_timeout(300)
            row = await A.query_selector(".fol2 .ft-list .sky-row:has-text('Iron Greatsword')")
            if row: await clean(A); await row.click(); await A.wait_for_timeout(300)
            await tap(A, ".fol2 .ft-detail [data-op=eq]"); await A.wait_for_timeout(300)
            worn = await A.evaluate("() => { const f = FOL2.st(window.__dbg.save()); return f.inv.find(r => r.id === f.eq.weapon)?.item }")
            check(worn == "iron_greatsword", style + " equip from their pack: " + str(worn))
            await snap(A, ".fol2", f"{SHOT}{style}_pack.png")
            await tap(A, ".fol2 [data-op=best]"); await A.wait_for_timeout(300)
            worn2 = await A.evaluate("() => { const f = FOL2.st(window.__dbg.save()); return f.inv.find(r => r.id === f.eq.weapon)?.item }")
            check(worn2 != "iron_greatsword", style + " best gear: a warrior goes back to sword and shield: " + str(worn2))
            await tap(A, ".fol2 [data-op=view][data-id=perks]"); await A.wait_for_timeout(500)
            sky = await A.query_selector(".fol2 .fol2sky svg")
            check(sky, style + " skills & perks view draws a constellation")
            await snap(A, ".fol2", f"{SHOT}{style}_perks.png")
            await tap(A, ".fol2 [data-op=view][data-id=card]"); await A.wait_for_timeout(300)
            await tap(A, ".fol2 [data-op=arch][data-id=twohand]"); await A.wait_for_timeout(300)
            arch = await A.evaluate("() => FOL2.st(window.__dbg.save()).arch")
            check(arch == "twohand", style + " change fighting style")
            await tap(A, ".fol2 [data-op=arch][data-id=warrior]"); await A.wait_for_timeout(300)
            # ---- party: A and B travel together, each sees the other's follower
            ida = await A.evaluate("window.__dbg.save().id"); idb = await B.evaluate("window.__dbg.save().id")
            await A.evaluate(f"() => Store.put('parties', 'fl{style}', {{ leader: '{ida}', leaderName: 'Alfa', members: [{{ id: '{ida}', name: 'Alfa' }}, {{ id: '{idb}', name: 'Beta' }}], invites: [], t: G.now() }})")
            await A.wait_for_timeout(1200)
            trip = "() => { const S = window.__dbg.save(); S.location = null; G.startTrip(S, 'Riverwood', WORLD.places.Riverwood.slice(0, 2)); window.__dbg.publish(); }"
            await A.evaluate(trip); await B.evaluate(trip)
            pa = pb = False
            for _ in range(12):
                await A.wait_for_timeout(700)
                pa = await A.evaluate("() => window.__dbg.others().some(o => o.name === 'Beta' && o.fold && o.fold.id === 'jenassa')")
                pb = await B.evaluate("() => window.__dbg.others().some(o => o.name === 'Alfa' && o.fold && o.fold.id === 'lydia')")
                if pa and pb: break
            check(pa and pb, style + " each card carries the other's follower")
            members = await A.evaluate("() => window.__dbg.party()?.members.length")
            check(members == 2, style + " followers are not party members: " + str(members))
            for pg, nm, want in ((A, "a", "Jenassa"), (B, "b", "Lydia")):
                await tap(pg, "[data-tab=map]"); await pg.wait_for_timeout(1500)
                comp = await pg.evaluate("() => { const S = window.__dbg.save(); return PARTY.companions(S, window.__dbg.party(), window.__dbg.others(), [S.x, S.y], (o) => [o.x, o.y], MP.NEAR_PX).map(m => m.name) }")
                check(want in comp, style + " " + nm + " sees " + want + " walking along: " + str(comp))
                got = await snap(pg, ".tripvig canvas", f"{SHOT}{style}_travel_{nm}.png")
                if not got: await pg.wait_for_timeout(1500); got = await snap(pg, ".tripvig canvas", f"{SHOT}{style}_travel_{nm}.png")
                check(got, style + " " + nm + " travel picture")
            # ---- a road fight on A's side with B next to A: Jenassa fights for A too
            posA = await A.evaluate("() => { const S = window.__dbg.save(); return [S.x, S.y]; }")
            await B.evaluate(f"() => {{ const S = window.__dbg.save(); S.trip = null; S.location = null; S.x = {posA[0]}; S.y = {posA[1]}; window.__dbg.publish(); }}")
            await A.evaluate("""() => { const S = window.__dbg.save(); const base = D.ENCOUNTERS.find(e => e.name === 'Bandit outlaw') || D.ENCOUNTERS[0];
                S.trip.status = 'encounter'; S.trip.encounter = { ...G.scaleEnemy(base, S.level), hold: 'Whiterun', danger: base.danger }; window.__dbg.publish(); }""")
            await A.wait_for_timeout(1800)
            await tap(A, "[data-tab=map]"); await A.wait_for_timeout(400)
            if await A.query_selector("[data-act=openenc]"): await A.click("[data-act=openenc]")
            await A.wait_for_timeout(400)
            await A.click("[data-act=enc][data-a=fight]"); await A.wait_for_timeout(1800)
            el = await A.query_selector("#modal .fscene")
            log = await A.evaluate("[...document.querySelectorAll('#modal .flog div')].map(d=>d.textContent).join(' | ')")
            check("Jenassa" in log and "Lydia" in log, style + " B's follower and A's own fight in A's fight: " + log[:160])
            if el:
                await A.wait_for_timeout(1500); await snap(A, "#modal .fscene", f"{SHOT}{style}_fight.png")
            await ctx.close()
        await b.close()
        print("errors:", errs)
        print("RESULT OK" if ok and not errs else "RESULT FAIL")
asyncio.run(main())
