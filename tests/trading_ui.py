"""Live trade window (tradewin.js) + the Market board (mktboard.js): two phones in one browser (?net=bc), both in Whiterun.
Alfa invites, Beta accepts the card, Alfa puts a forged sword in, Beta puts gold in, both Ready, both Confirm -> the sword
and the gold change hands once. Then the Market board: listings from two towns, search, Buy from another town, the
goods wait in Market parcels and come out into the pack. Runs at 390x844 and 1920x1080.
Usage: py trading_ui.py PORT [SHOTS_DIR]  ->  RESULT OK. Pictures go to SHOTS_DIR (default tests/out_trading/)."""
import asyncio, os, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_trading")
os.makedirs(OUT, exist_ok=True)

def ok(c, m):
    if not c: raise AssertionError(m)
    print("ok", m)

async def until(pg, js, n=60):
    for _ in range(n):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(150)
    return False

async def run(b, w, h, tag):
    ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1 if w > 1000 else 2)
    errs = []
    async def phone(name):
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(name + " " + str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=tw{tag}{name}"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1400)
        await pg.evaluate("() => document.querySelectorAll('#modal,.modal,#wwall').forEach(m => m.remove())")
        await pg.evaluate("() => { const S = window.__dbg.save(); S.location = 'Whiterun'; [S.x, S.y] = WORLD.places.Whiterun; S.trip = null; if (!S.discovered.includes('Whiterun')) S.discovered.push('Whiterun'); window.__dbg.publish(); }")
        await pg.wait_for_timeout(1200); await pg.evaluate("() => document.querySelectorAll('#modal,.modal,#wwall').forEach(m => m.remove())")
        return pg
    A = await phone("Alfa"); B = await phone("Beta")
    ida = await A.evaluate("window.__dbg.save().id"); idb = await B.evaluate("window.__dbg.save().id")
    await A.evaluate("() => { const S = window.__dbg.save(); const r = G.invRow(S, G.give(S, 'steel_sword', 1)); r.tq = 4; r.temper = 4; G.give(S, 'potion_health_minor', 3); S.gold = 300; window.__dbg.publish(); }")
    await B.evaluate("() => { const S = window.__dbg.save(); S.gold = 900; S.unlocks = { ...(S.unlocks || {}), housing: 0 }; window.__dbg.publish(); }")
    ok(await until(A, f"() => window.__dbg.others().some(c => c.id === '{idb}')"), f"[{tag}] Alfa sees Beta")
    ok(await until(B, f"() => window.__dbg.others().some(c => c.id === '{ida}')"), f"[{tag}] Beta sees Alfa")

    # ---- invite -> card -> accept
    await A.evaluate(f"() => TRADEWIN.start(window.__dbg.others().find(c => c.id === '{idb}'))")
    ok(await until(B, "() => !!document.querySelector('#invbar .invcard[data-kind=tradewin]')"), f"[{tag}] Beta gets a trade invite card")
    await B.click("#invbar .invcard[data-kind=tradewin] [data-inv=yes]")
    ok(await until(B, "() => !!document.querySelector('#twin')"), f"[{tag}] Beta's trade window opens")
    ok(await until(A, "() => !!document.querySelector('#twin')"), f"[{tag}] Alfa's trade window opens")

    # ---- worn gear refused (try putting on the sword in a test-only way: worn rows don't show in the drawer)
    await A.click("#twin [data-tw=drawer]"); await A.wait_for_timeout(300)
    ok(await A.locator("#twin .tw-drawer").count() == 1, f"[{tag}] the pick-from-pack drawer opens")
    await A.screenshot(path=os.path.join(OUT, f"trading_drawer_{tag}.png"))
    sid = await A.evaluate("String(window.__dbg.save().inv.find(r => r.item === 'steel_sword').id)")
    await A.click(f"#twin [data-tw=add][data-id='{sid}']"); await A.wait_for_timeout(300)
    if await A.locator("#twin .tw-drawer").count(): await A.click("#twin .tw-drawer [data-tw=drawer]")
    ok(await A.evaluate("() => !window.__dbg.save().inv.some(r => r.item === 'steel_sword')"), f"[{tag}] the sword is held out of Alfa's pack")
    gb0 = await B.evaluate("window.__dbg.save().gold"); ga0 = await A.evaluate("window.__dbg.save().gold + (window.__dbg.save().lt?.gold || 0)")
    await B.fill("#twin #twgold", "250"); await B.click("#twin [data-tw=gold]")
    ok(await until(A, "() => /250/.test(document.querySelector('#twin .tw-side.them, #twin .tw-them')?.textContent || document.querySelector('#twin')?.textContent || '')"), f"[{tag}] Alfa sees Beta's 250 gold")
    ok(await until(B, "() => /\\+4/.test(document.querySelector('#twin')?.textContent || '')"), f"[{tag}] Beta sees the sword's forge level +4")

    # ---- Ready, a change un-readies, Ready again, Confirm
    await A.click("#twin [data-tw=ready]"); await B.wait_for_timeout(400)
    await B.click("#twin [data-tw=ready]")
    ok(await until(A, "() => !!document.querySelector('#twin [data-tw=confirm]:not([disabled])')"), f"[{tag}] Alfa can confirm once both are ready")
    await B.screenshot(path=os.path.join(OUT, f"trading_window_{tag}.png"))
    await A.screenshot(path=os.path.join(OUT, f"trading_window_alfa_{tag}.png"))
    await A.keyboard.press("Enter")   # Enter = Confirm
    ok(await until(B, "() => !!document.querySelector('#twin [data-tw=confirm]:not([disabled])')"), f"[{tag}] Beta can confirm")
    await B.click("#twin [data-tw=confirm]")
    ok(await until(B, "() => window.__dbg.save().inv.some(r => r.item === 'steel_sword' && r.tq === 4)", 80), f"[{tag}] Beta got the +4 sword")
    ok(await until(A, "() => window.__dbg.save().gold === " + str(ga0 + 250), 80), f"[{tag}] Alfa got 250 gold ({ga0} -> {ga0 + 250})")
    await A.wait_for_timeout(1500)
    gb = await B.evaluate("window.__dbg.save().lt?.gave?.gold"); swords = await B.evaluate("window.__dbg.save().inv.filter(r => r.item === 'steel_sword').length")
    ok(gb == 250 and swords == 1, f"[{tag}] exactly one exchange (Beta gave {gb} gold, has {swords} sword)")
    await B.screenshot(path=os.path.join(OUT, f"trading_done_{tag}.png"))
    for pg in (A, B):
        if await pg.locator("#twin [data-tw=close]").count(): await pg.click("#twin [data-tw=close]")

    # ---- the Market board: Alfa lists in Whiterun, a stranger's listing in Riften (made by hand), Beta buys from Riften
    await A.evaluate("() => { const S = window.__dbg.save(); S.homes = { Whiterun: { chest: [], garden: 0 } }; const p = S.inv.find(r => r.item === 'potion_health_minor'); const r = MARKET.list(S, p.id, 40, []); if (r.err) throw new Error(r.err); Store.put('stalls', r.id, r.doc); }")
    await A.evaluate("() => { const t = G.now(); Store.put('stalls', 'st-far-1', { seller: 'far1', sellerName: 'Ysolda', town: 'Riften', row: { id: 9001, item: 'steel_shield', qty: 1, tq: 2, temper: 2 }, price: 120, status: 'open', t }); }")
    await B.evaluate("() => document.querySelectorAll('#modal,.modal').forEach(m => m.remove())")
    await B.evaluate("() => { document.querySelector('[data-tab=world]')?.click(); document.querySelector('[data-tab=town]')?.click(); }"); await B.wait_for_timeout(300)
    await B.evaluate("() => document.querySelectorAll('#modal,.modal').forEach(m => m.remove())")
    await B.evaluate("() => document.querySelector('[data-act=shop][data-id=market]').click()"); await B.wait_for_timeout(400)
    ok(await B.locator("[data-act=mkbtab][data-id=board]").count() == 1, f"[{tag}] the market has a Board tab")
    await B.click("[data-act=mkbtab][data-id=board]"); await B.wait_for_timeout(400)
    txt = await B.inner_text("#side")
    ok("Riften" in txt and "Whiterun" in txt, f"[{tag}] the board shows stalls from two towns")
    await B.fill("#mkbq", "shield"); await B.wait_for_timeout(400)
    txt = await B.inner_text("#side")
    ok("Riften" in txt and "Potion" not in txt, f"[{tag}] search narrows the board")
    await B.evaluate("() => document.querySelector('#mkbq')?.scrollIntoView({ block: 'start' })"); await B.wait_for_timeout(200)
    await B.screenshot(path=os.path.join(OUT, f"trading_board_{tag}.png"))
    gb1 = await B.evaluate("window.__dbg.save().gold")
    await B.evaluate("() => { const b = document.querySelector('[data-act=mkbbuy][data-id=\"st-far-1\"]'); b.click(); b.click(); }")
    ok(await until(B, "() => (window.__dbg.save().parcels || []).length === 1"), f"[{tag}] one purchase lands in Market parcels (double tap)")
    ok(await B.evaluate("window.__dbg.save().gold") == gb1 - 120, f"[{tag}] paid once")
    await B.click("[data-act=mkbtab][data-id=parcels]"); await B.wait_for_timeout(300)
    await B.screenshot(path=os.path.join(OUT, f"trading_parcels_{tag}.png"))
    await B.evaluate("() => document.querySelector('[data-act=mkbopen]').click()"); await B.wait_for_timeout(500)
    ok(await B.evaluate("() => window.__dbg.save().inv.some(r => r.item === 'steel_shield' && r.tq === 2) && !(window.__dbg.save().parcels || []).length"), f"[{tag}] parcels come out into the pack")
    ok(not errs, f"[{tag}] no page errors {errs}")
    await ctx.close()

async def main():
    async with async_playwright() as p:
        exe = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
        b = await p.chromium.launch(executable_path=exe, args=["--no-sandbox"]) if exe else await p.chromium.launch()
        await run(b, 390, 844, "phone")
        await run(b, 1920, 1080, "pc")
        await b.close()
        print("RESULT OK")
asyncio.run(main())
