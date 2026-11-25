import asyncio, sys
from playwright.async_api import async_playwright
_SHOTS = (__import__("os").environ.get("SHOTS") or __import__("os").path.join(__import__("tempfile").gettempdir(), "rotn_shots")).replace("\\", "/").rstrip("/") + "/"   # screenshots: $SHOTS or the temp folder
__import__("os").makedirs(_SHOTS, exist_ok=True)
PORT = sys.argv[1] if len(sys.argv) > 1 else "8822"
SHOT = _SHOTS + "coop_"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        async def phone(tag, name):
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(tag + " " + str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p={tag}{name}"); await pg.wait_for_timeout(1800)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1200)
            await pg.evaluate("() => document.querySelectorAll('#modal,.modal').forEach(m => m.remove())")
            return pg
        async def clean(pg): await pg.evaluate("() => document.querySelectorAll('#modal,.modal,#wwall').forEach(m => m.remove())")
        async def tab(pg, t):
            await clean(pg); await pg.click(f"[data-tab={t}]"); await pg.wait_for_timeout(300)
        place = "() => { const S = window.__dbg.save(); S.location = 'Bleak Falls Barrow'; [S.x, S.y] = WORLD.places['Bleak Falls Barrow']; S.trip = null; S.level = 14; S.cleared = {}; if (typeof EXPLORE !== 'undefined') { const c = EXPLORE.CLAWS['Bleak Falls Barrow']; if (c) G.give(S, c.item, 1); } S.discovered = [...new Set([...(S.discovered||[]), 'Bleak Falls Barrow'])]; }"
        A = await phone("c", "Alfa"); B = await phone("c", "Beta")
        for pg in (A, B): await pg.evaluate(place)
        # friends both ways
        ida = await A.evaluate("window.__dbg.save().id"); idb = await B.evaluate("window.__dbg.save().id")
        await A.evaluate(f"() => SOCIAL.add(window.__dbg.save(), {{id: '{idb}', name: 'Beta'}})")
        await B.evaluate(f"() => SOCIAL.add(window.__dbg.save(), {{id: '{ida}', name: 'Alfa'}})")
        await tab(A, "log"); await tab(A, "world"); await tab(B, "log"); await tab(B, "world")
        await A.wait_for_timeout(800)
        assert await A.locator("[data-act=coopnew]").count() == 1, "lobby button"
        await A.click("[data-act=coopnew]"); await A.wait_for_timeout(700)
        await tab(A, "log"); await tab(A, "world")
        await A.locator(".coop").first.scroll_into_view_if_needed()
        await A.screenshot(path=SHOT + "lobby_A.png", full_page=True)
        n = await A.locator(f"[data-act=coopinv][data-id='{idb}']").count()
        assert n == 1, "Beta listed as friend to invite"
        await A.click(f"[data-act=coopinv][data-id='{idb}']"); await A.wait_for_timeout(1000)
        await clean(B); await B.evaluate("()=>window.__ui.go('social')"); await B.wait_for_timeout(300); await B.click("[data-act=soctab][data-id=party]"); await B.wait_for_timeout(300)   # invites live in \ue106 Friends → Party
        assert await B.locator("[data-act=coopjoin]").count() >= 1, "B sees invite in Friends → Party"
        await B.locator("#j-coop").scroll_into_view_if_needed(); await B.screenshot(path=SHOT + "invite_B.png")
        await B.locator("[data-act=coopjoin]").first.click(); await B.wait_for_timeout(900)
        await tab(A, "log"); await tab(A, "world")
        await A.click("[data-act=coopgo]"); await A.wait_for_timeout(1500)
        await clean(B)
        inB = await B.evaluate("() => window.__dbg.save().dungeon?.run || null")
        inA = await A.evaluate("() => window.__dbg.save().dungeon?.run || null")
        print("A run", inA, "B run", inB)
        assert inA and inA == inB, "B followed A in"
        await B.screenshot(path=SHOT + "wait_B.png")
        assert await B.locator("#dun").inner_text() and "waiting for" in (await B.locator("#dun").inner_text()).lower(), "B waits for leader"
        # walk rooms: A picks, both resolve
        for step in range(12):
            await clean(A); await clean(B)
            done = await A.evaluate("() => !!window.__dbg.save().dungeon?.done")
            if done: break
            room = await A.evaluate("() => window.__dbg.save().dungeon?.room?.type || null")
            if not room:
                await A.locator("#dun [data-act=droom]").first.click(); await A.wait_for_timeout(1200)
            ra = await A.evaluate("() => { const d = window.__dbg.save().dungeon; return d?.room ? [d.row, d.col, d.room.type, d.room.enemy?.name || ''] : null }")
            rb = await B.evaluate("() => { const d = window.__dbg.save().dungeon; return d?.room ? [d.row, d.col, d.room.type, d.room.enemy?.name || ''] : null }")
            print("step", step, "A", ra, "B", rb)
            assert ra and rb and ra[:3] == rb[:3], "same room"
            if ra[2] != "boss": assert ra[3] == rb[3], "same foe"
            # keep everyone healthy for the test
            for pg in (A, B): await pg.evaluate("() => { const S = window.__dbg.save(); G.setHealth(S, 9999); const e = S.dungeon?.room?.enemy; if (e) { e.health = e.hp = 60; e.damage = 1; } }")
            if ra[3]:
                # B fights first, A is in the same room: A should fight beside B
                await B.locator("#dun [data-act=dact][data-c=fight]").first.click(); await B.wait_for_timeout(900)
                if not await B.locator("#dun").count():
                    print("B no #dun:", await B.evaluate("() => JSON.stringify({d: !!window.__dbg.save().dungeon, modal: document.querySelector('#modal')?.innerText?.slice(0,300)})"))
                log = await B.locator("#dun").inner_text()
                if step < 2: await B.screenshot(path=SHOT + f"fight_B{step}.png")
                assert "alfa" in log.lower(), "Alfa fights beside Beta"
                await A.locator("#dun [data-act=dact][data-c=fight]").first.click(); await A.wait_for_timeout(900)
            else:
                for pg in (A, B):
                    await clean(pg)
                    btn = pg.locator("#dun [data-act=dact][data-c^=set], #dun [data-act=dact]:not([data-c^=game])").last
                    if await btn.count(): await btn.click(); await pg.wait_for_timeout(500)
                    # rooms that let you stay (broken pick, puzzle): leave them
                    for _ in range(4):
                        if not await pg.evaluate("() => !!window.__dbg.save().dungeon?.room"): break
                        await clean(pg); await pg.locator("#dun [data-act=dact]:not([data-c^=game])").last.click(); await pg.wait_for_timeout(400)
            await A.wait_for_timeout(600)
        da = await A.evaluate("() => window.__dbg.save().dungeon?.done"); db = await B.evaluate("() => window.__dbg.save().dungeon?.done")
        print("done", da, db)
        assert da and db, "both cleared"
        await clean(A); await clean(B); await A.wait_for_timeout(800)
        await A.evaluate("() => document.querySelector('[data-act=coopclaim]')?.scrollIntoView()")
        await A.screenshot(path=SHOT + "chest_A.png")
        ga = await A.evaluate("window.__dbg.save().gold")
        await A.click("[data-act=coopclaim]"); await A.wait_for_timeout(900)
        ga2 = await A.evaluate("window.__dbg.save().gold")
        assert ga2 > ga, "A got a share"
        assert await A.locator("[data-act=coopclaim]").count() == 0, "claim button gone"
        # no double claim even by forcing it
        await A.evaluate("() => { const b = document.createElement('button'); b.dataset.act = 'coopclaim'; b.id='fake'; document.querySelector('#dun').appendChild(b); }")
        await A.click("#fake"); await A.wait_for_timeout(700)
        assert await A.evaluate("window.__dbg.save().gold") == ga2, "no second share"
        gb = await B.evaluate("window.__dbg.save().gold")
        await clean(B); await B.click("[data-act=coopclaim]"); await B.wait_for_timeout(900)
        assert await B.evaluate("window.__dbg.save().gold") > gb, "B got own share"
        print("gold A", ga, "->", ga2, "B", gb, "->", await B.evaluate("window.__dbg.save().gold"))
        await B.screenshot(path=SHOT + "chest_B.png")
        print("errors:", errs)
        assert not errs
        print("RESULT OK")
        await b.close()
asyncio.run(main())
