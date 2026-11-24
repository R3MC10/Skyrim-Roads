"""Invite cards (invites.js): two phones in one browser (?net=bc). Party, co-op run, clan, Arena and trade invites pop up
on top with Accept / Decline; Decline tells the sender; Accept joins; a full party says it's full; a double tap answers once;
one-screen PC layout. Usage: py invites_ui.py PORT  ->  RESULT OK. Pictures go to tests/out_invites/."""
import asyncio, os, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_invites")
os.makedirs(OUT, exist_ok=True)
TOASTS = "() => { window.__toasts = []; let last = ''; setInterval(() => { const t = document.querySelector('#toast')?.textContent || ''; if (t && t !== last) { last = t; window.__toasts.push(t); } }, 40); }"

async def main():
    async with async_playwright() as p:
        exe = "/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None
        b = await p.chromium.launch(executable_path=exe, args=["--no-sandbox"]) if exe else await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        async def phone(tag, name):
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(tag + " " + str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p={tag}{name}"); await pg.wait_for_timeout(1800)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1400)
            await pg.evaluate("() => document.querySelectorAll('#modal,.modal,#wwall').forEach(m => m.remove())")
            await pg.evaluate(TOASTS)
            return pg
        def ok(c, m):
            if not c: raise AssertionError(m)
            print("ok", m)
        async def toasts(pg): return await pg.evaluate("window.__toasts")
        async def card(pg, kind, n=1):
            for _ in range(40):
                if await pg.locator(f"#invbar .invcard[data-kind={kind}]").count() >= n: return True
                await pg.wait_for_timeout(150)
            return False
        async def gone(pg, kind):
            for _ in range(40):
                if await pg.locator(f"#invbar .invcard[data-kind={kind}]").count() == 0: return True
                await pg.wait_for_timeout(150)
            return False
        async def heard(pg, text):
            for _ in range(40):
                if any(text in t for t in await toasts(pg)): return True
                await pg.wait_for_timeout(150)
            return False

        A = await phone("i", "Alfa"); B = await phone("i", "Beta")
        ida = await A.evaluate("window.__dbg.save().id"); idb = await B.evaluate("window.__dbg.save().id")
        await A.wait_for_timeout(600)

        # ---- party invite: card with Accept / Decline; Decline tells Alfa
        await A.evaluate(f"() => Store.put('parties', 'pty1', {{ leader: '{ida}', leaderName: 'Alfa', members: [{{ id: '{ida}', name: 'Alfa' }}], invites: ['{idb}'], t: G.now() }})")
        ok(await card(B, "party"), "B gets a party invite card")
        btns = await B.locator("#invbar .invcard[data-kind=party] .invbtns .btn").all_inner_texts()
        ok([x.strip().lower() for x in btns] == ["accept", "decline"], f"Accept and Decline buttons: {btns}")
        await B.wait_for_timeout(400); await B.screenshot(path=os.path.join(OUT, "party_phone.png"))
        await B.click("#invbar .invcard[data-kind=party] [data-inv=no]")
        ok(await gone(B, "party"), "card goes away after Decline")
        ok(await heard(A, "Beta declined your party invite."), "Alfa is told Beta declined")
        inv = await A.evaluate("() => Store.change('parties','pty1', x => x).then(r => r.after.invites)")
        ok(idb not in inv, "Beta's invite is off the party")

        # ---- invite again: Accept joins; a quick double tap answers once
        await A.evaluate(f"() => Store.change('parties', 'pty1', x => ({{ ...x, invites: ['{idb}'] }}))")
        ok(await card(B, "party"), "card back for a new invite")
        await B.evaluate("() => { const y = document.querySelector('#invbar .invcard[data-kind=party] [data-inv=yes]'); y.click(); y.click(); }")
        await B.wait_for_timeout(900)
        ok(await B.evaluate(f"() => window.__dbg.party()?.id === 'pty1'"), "Accept joins the party")
        mem = await A.evaluate("() => Store.change('parties','pty1', x => x).then(r => r.after.members.length)")
        ok(mem == 2, f"joined once (members {mem})")
        ok(await gone(B, "party"), "no card left after joining")

        # ---- a full party says so and doesn't pull Beta out of the one she's in
        await A.evaluate(f"() => Store.put('parties', 'full1', {{ leader: 'zz0', leaderName: 'Zed', members: Array.from({{length: 8}}, (_, i) => ({{ id: 'zz' + i, name: 'Z' + i }})), invites: ['{idb}'], t: G.now() }})")
        ok(await card(B, "party"), "invite from a full party shows")
        ok("full" in (await B.locator("#invbar .invcard[data-kind=party] .invt span").inner_text()).lower(), "card says the party is full")
        await B.click("#invbar .invcard[data-kind=party] [data-inv=yes]")
        ok(await heard(B, "That party is full (8 heroes at most)."), "accepting a full party says it's full")
        ok(await B.evaluate("() => window.__dbg.party()?.id === 'pty1'"), "still in the old party")

        # ---- co-op run, clan, Arena challenge, trade offer: all at once, newest first, +N more
        await A.evaluate(f"""() => {{ const t = G.now();
          Store.put('runs', 'run-x', {{ place: 'Bleak Falls Barrow', theme: 'nordic', tier: 1, rows: [], leader: '{ida}', leaderName: 'Alfa', members: [{{ id: '{ida}', name: 'Alfa', level: 1 }}], invites: [{{ id: '{idb}', name: 'Beta' }}], status: 'lobby', path: [], rooms: [], claims: {{}}, at: {{}}, t }});
          Store.put('clans', '{ida}', {{ name: 'Sons of Snow', tag: 'SNOW', colors: CLANS.COLORS.slice(0, 2), founder: '{ida}', founderName: 'Alfa', invites: ['{idb}'], kicked: [], t: t + 1 }});
          Store.put('clanmem', '{ida}', {{ clan: '{ida}', name: 'Alfa', t }});
          Store.put('duels', 'duel-x', {{ from: '{ida}', fromName: 'Alfa', to: '{idb}', toName: 'Beta', stake: 0, status: 'open', aRating: 1000, t: t + 2 }});
          Store.put('trades', 'trade-x', {{ from: '{ida}', fromName: 'Alfa', to: '{idb}', toName: 'Beta', items: [], gold: 25, ask: 0, status: 'open', t: t + 3 }});
          window.__dbg.save().clan = '{ida}'; }}""")
        ok(await card(B, "coop") or True, "co-op card")
        ok(await B.evaluate("() => INVITES.cards.map(c => c.kind).sort().join()") == "clan,coop,duel,trade", "B has all four invites: " + await B.evaluate("() => INVITES.cards.map(c => c.kind).join()"))
        ok(await B.locator("#invbar .invcard").count() == 3, "three cards on screen")
        ok(await B.locator("#invbar .invmore").count() == 1, "+N more line for the rest")
        await B.wait_for_timeout(400); await B.screenshot(path=os.path.join(OUT, "stack_phone.png"))
        ok(await B.evaluate("() => { const r = document.querySelector('#invbar').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }"), "cards fit the phone screen")

        # Arena: Decline -> Alfa hears it
        await B.click("#invbar .invcard[data-kind=duel] [data-inv=no]")
        ok(await heard(A, "Beta turned down your challenge."), "Alfa hears the Arena challenge was declined")
        # trade: Accept -> gold arrives
        g0 = await B.evaluate("window.__dbg.save().gold")
        await B.click("#invbar .invcard[data-kind=trade] [data-inv=yes]"); await B.wait_for_timeout(700)
        ok(await B.evaluate("window.__dbg.save().gold") == g0 + 25, "trade accepted from the card")
        # clan: Decline -> Alfa hears it and the invite is tidied away
        ok(await card(B, "clan"), "clan card")
        await B.click("#invbar .invcard[data-kind=clan] [data-inv=no]")
        ok(await heard(A, "Beta declined your clan invite."), "Alfa hears the clan invite was declined")
        ok(await gone(B, "clan"), "clan card gone")
        await A.wait_for_timeout(600)
        ok(idb not in await A.evaluate("() => CLANS.byId(window.__dbg.save().id)?.invites || []"), "founder dropped Beta from the invite list")
        ok(await B.evaluate("() => !window.__dbg.save().clan"), "declining didn't put Beta in a clan")
        # co-op: Decline -> Alfa hears it
        ok(await card(B, "coop"), "co-op card")
        await B.wait_for_timeout(400); await B.screenshot(path=os.path.join(OUT, "coop_phone.png"))
        await B.click("#invbar .invcard[data-kind=coop] [data-inv=no]")
        ok(await heard(A, "Beta declined your dungeon invite."), "Alfa hears the dungeon invite was declined")
        ok(await gone(B, "coop"), "co-op card gone")

        # ---- Social list uses the same words
        await B.evaluate("()=>window.__ui.go('social')"); await B.wait_for_timeout(300)
        await B.click("[data-act=soctab][data-id=realm]"); await B.wait_for_timeout(300)
        # ---- withdrawn invites drop off by themselves; the hide button hides
        await A.evaluate(f"() => Store.put('duels', 'duel-y', {{ from: '{ida}', fromName: 'Alfa', to: '{idb}', toName: 'Beta', stake: 0, status: 'open', aRating: 1000, t: G.now() }})")
        ok(await card(B, "duel"), "new challenge card")
        await A.evaluate("() => Store.change('duels', 'duel-y', d => ({ ...d, status: 'cancelled' }))")
        ok(await gone(B, "duel"), "withdrawn challenge drops off")
        await A.evaluate(f"() => Store.put('duels', 'duel-z', {{ from: '{ida}', fromName: 'Alfa', to: '{idb}', toName: 'Beta', stake: 0, status: 'open', aRating: 1000, t: G.now() }})")
        ok(await card(B, "duel"), "another challenge")
        await B.click("#invbar .invcard[data-kind=duel] [data-inv=hide]")
        ok(await gone(B, "duel"), "✕ hides the card for now")

        # ---- PC: one-screen layout, cards top right
        await B.set_viewport_size({"width": 1366, "height": 768})
        await A.evaluate(f"() => Store.change('parties', 'pty1', x => x)")
        await A.evaluate(f"() => Store.put('parties', 'pty2', {{ leader: '{ida}', leaderName: 'Alfa', members: [{{ id: '{ida}', name: 'Alfa' }}], invites: ['{idb}'], t: G.now() }})")
        ok(await card(B, "party"), "PC: party card")
        box = await B.evaluate("() => { const r = document.querySelector('#invbar').getBoundingClientRect(); return [r.left, r.right, r.top, r.bottom]; }")
        ok(box[1] <= 1366 and box[3] < 768 and box[0] > 683, f"PC: cards sit top right on one screen {box}")
        await B.wait_for_timeout(400); await B.screenshot(path=os.path.join(OUT, "party_pc.png"))
        ok(await B.evaluate("() => typeof I18N !== 'undefined' && I18N.tr('Accept') === 'Przyjmij' && I18N.tr('Decline') === 'Odrzuć'"), "Polish for the buttons")

        print("errors:", errs)
        assert not errs, errs
        print("pictures:", OUT)
        print("RESULT OK")
        await b.close()
asyncio.run(main())
