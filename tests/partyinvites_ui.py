"""Party members never get separate invites (coop.js, friendjoin.js, ui.js). Three phones in one browser (?net=bc):
Alfa leads a party with Beta; Xan is a friend outside it. Beta's Friends list shows "In your party" for Alfa (no Ask to
join). Alfa starts a co-op run at a dungeon door: Beta is in it at once (no invite card, no Accept), the lobby offers
only Xan. Phone and PC screenshots.
Usage: py partyinvites_ui.py PORT [OUTDIR] [before]  ->  RESULT OK   ("before": screenshots only, no checks)"""
import asyncio, os, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.environ.get("TEMP", "/tmp"), "rotn_partyinvites")
BEFORE = len(sys.argv) > 3 and sys.argv[3] == "before"
TAG = "partyinvites_before_" if BEFORE else "partyinvites_"
os.makedirs(OUT, exist_ok=True)

async def main():
    async with async_playwright() as p:
        exe = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
        b = await p.chromium.launch(executable_path=exe, args=["--no-sandbox"]) if exe else await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        async def phone(tag, name):
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(tag + name + " " + str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p={tag}{name}"); await pg.wait_for_timeout(1800)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1400)
            await clean(pg)
            return pg
        async def clean(pg): await pg.evaluate("() => document.querySelectorAll('#modal,.modal,#wwall').forEach(m => m.remove())")
        def ok(c, m):
            if BEFORE: print("(before)", m, bool(c)); return
            if not c: raise AssertionError(m)
            print("ok", m)
        async def until(pg, js, n=60):
            for _ in range(n):
                if await pg.evaluate(js): return True
                await pg.wait_for_timeout(150)
            return False
        async def tab(pg, t):
            await clean(pg); await pg.evaluate(f"() => window.__ui.go('{t}')"); await pg.wait_for_timeout(300)
        place = "() => { const S = window.__dbg.save(); S.location = 'Bleak Falls Barrow'; [S.x, S.y] = WORLD.places['Bleak Falls Barrow']; S.trip = null; S.level = 14; S.cleared = {}; if (typeof EXPLORE !== 'undefined') { const c = EXPLORE.CLAWS['Bleak Falls Barrow']; if (c) G.give(S, c.item, 1); } S.discovered = [...new Set([...(S.discovered||[]), 'Bleak Falls Barrow'])]; }"

        A = await phone("pi", "Alfa"); B = await phone("pi", "Beta"); X = await phone("pi", "Xan")
        ida = await A.evaluate("window.__dbg.save().id"); idb = await B.evaluate("window.__dbg.save().id"); idx = await X.evaluate("window.__dbg.save().id")
        for pg in (A, B, X): await pg.evaluate(place)
        await A.evaluate(f"() => {{ const s = window.__dbg.save(); s.friends = {{ '{idb}': {{ name: 'Beta', t: G.now() }}, '{idx}': {{ name: 'Xan', t: G.now() }} }}; }}")
        await B.evaluate(f"() => {{ const s = window.__dbg.save(); s.friends = {{ '{ida}': {{ name: 'Alfa', t: G.now() }} }}; }}")
        # Alfa leads a party with Beta (an old invite to Beta still lingers on the record)
        await A.evaluate(f"() => Store.put('parties', 'pp1', {{ leader: '{ida}', leaderName: 'Alfa', members: [{{ id: '{ida}', name: 'Alfa' }}, {{ id: '{idb}', name: 'Beta' }}], invites: ['{idb}'], t: G.now() }})")
        ok(await until(B, f"() => window.__dbg.party()?.leader === '{ida}'", 80), "Beta is in Alfa's party")
        ok(await until(A, "() => !(window.__dbg.party()?.invites || []).length", 80), "the stale party invite to Beta is dropped")
        ok(await until(B, f"() => {{ let c=null; Store.watchPlayers(ps => c = ps.find(x => x.id === '{ida}')); return !!(c && c.fj); }}", 80), "Alfa's card is published")

        # Beta's Friends list: Alfa shows "In your party", no Ask to join
        await tab(B, "social"); await B.click("[data-act=soctab][data-id=friends]"); await B.wait_for_timeout(800)
        ok(await B.locator(f"[data-act=fjoin][data-id='{ida}']").count() == 0, "no Ask to join for Alfa")
        ok(await B.locator(".fbtns .inparty").count() == 1 and "In your party" in await B.locator(".fbtns .inparty").text_content(), "Alfa's row says In your party")
        await B.screenshot(path=os.path.join(OUT, TAG + "friends_phone.png"))

        # Alfa starts a co-op run: Beta is in it straight away, only Xan can be invited
        await tab(A, "log"); await tab(A, "map"); await A.wait_for_timeout(800)
        await A.click("[data-act=coopnew]"); await A.wait_for_timeout(900)
        await tab(A, "log"); await tab(A, "map"); await A.wait_for_timeout(600)
        ok(await until(A, f"() => !!document.querySelector('.coop.on') && document.querySelector('.coop.on').innerText.includes('Beta')", 60), "Beta is listed in the run")
        ok(await A.locator(f"[data-act=coopinv][data-id='{idb}']").count() == 0, "no Invite button for Beta")
        ok(await A.locator(f"[data-act=coopinv][data-id='{idx}']").count() == 1, "Xan (outside the party) can be invited")
        await A.locator(".coop.on").first.scroll_into_view_if_needed()
        await A.screenshot(path=os.path.join(OUT, TAG + "lobby_phone.png"))
        await B.wait_for_timeout(1200)
        ok(await B.evaluate("() => document.querySelectorAll('#invbar .invcard[data-kind=coop]').length") == 0, "no co-op invite card for Beta")
        await tab(B, "log"); await tab(B, "map"); await B.wait_for_timeout(600)
        ok(await until(B, "() => !!document.querySelector('.coop.on')", 40), "Beta's lobby shows the run she's in")
        ok(await B.locator("[data-act=coopjoin]").count() == 0 and await B.locator("[data-act=coopnew]").count() == 0, "Beta has nothing to accept and doesn't start her own run")
        await B.locator(".coop").first.scroll_into_view_if_needed()
        await B.screenshot(path=os.path.join(OUT, TAG + "lobby_member_phone.png"))
        # Alfa invites Xan, who gets the card as usual
        if await A.locator(f"[data-act=coopinv][data-id='{idx}']").count():
            await A.click(f"[data-act=coopinv][data-id='{idx}']")
            ok(await until(X, "() => document.querySelectorAll('#invbar .invcard[data-kind=coop]').length === 1", 80), "Xan gets an invite card")
        # PC
        for pg in (A, B): await pg.set_viewport_size({"width": 1920, "height": 1080})
        await A.wait_for_timeout(600); await tab(A, "log"); await tab(A, "map"); await A.wait_for_timeout(600)
        await A.screenshot(path=os.path.join(OUT, TAG + "lobby_pc.png"))
        await tab(B, "social"); await B.click("[data-act=soctab][data-id=friends]"); await B.wait_for_timeout(600)
        await B.screenshot(path=os.path.join(OUT, TAG + "friends_pc.png"))
        ok(not errs, "no page errors: " + "; ".join(errs[:3]))
        print("RESULT OK")
        await b.close()

asyncio.run(main())
