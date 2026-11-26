"""The defeat screen (defeat.js) on a phone (390x844) and a PC (1920x1080). Usage: python defeat_ui.py PORT [SHOTS_DIR] [before]
Loses a road fight on purpose, then checks: the defeat screen (not the old "Defeated" box) with Retry / Adjust gear / Retreat,
the foe's name and why you lost, nothing lost (gold, items, the encounter still there), Adjust gear opens Items with a bar
to come back, the difficulty chips, Retry starts the same foe again, Retreat puts you back on the road. Prints RESULT OK.
SHOTS_DIR (optional, never inside tests/): where defeatretry_*.png go. 'before' only screenshots the old result (main)."""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8901"
SHOTS = sys.argv[2] if len(sys.argv) > 2 else ""
BEFORE = len(sys.argv) > 3 and sys.argv[3] == "before"
CHROME = (os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None))
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

SETUP = """()=>{ document.querySelectorAll('#modal').forEach(m=>m.remove());
  const S=window.__dbg.save(); S.gold=432; G.give(S,'potion_health',1); G.setHealth(S,G.maxHealth(S)); S.dungeon=null; S.trip=null;
  S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
  const e=G.scaleEnemy({name:'Cave Troll',level:45,health:4000,damage:260,tags:['animal'],danger:'high',gold:[5,10],text:'A cave troll blocks the road.'},45); e.noGroup=true;
  S.trip.status='encounter'; S.trip.encounter=e; window.__dbg.openEncounter(); return S.gold; }"""

async def lose(pg):
    """fight the troll and let Auto finish (it wins)"""
    for _ in range(60):
        if await pg.evaluate("!!document.querySelector('#tbf .tbgrid, #tbf .tbdone')"): break
        await pg.wait_for_timeout(200)
    if await pg.evaluate("!!document.querySelector('#tbf') && !document.querySelector('#tbf .tbdone')"):
        await pg.evaluate("(()=>{const g=document.querySelector('#tbf .tbgrid')||document.querySelector('#tbf');const b=document.createElement('button');b.dataset.tbx='autoall';g.append(b);b.click()})()")
    for _ in range(200):
        if await pg.evaluate("!!document.querySelector('#tbf .tbdone')"): break
        await pg.wait_for_timeout(300)
    await pg.wait_for_timeout(600)
    if await pg.evaluate("!!document.querySelector('#tbf .tbdone')"):
        await pg.click("#tbf .tbdone"); await pg.wait_for_timeout(900)

async def run(b, name, vw, vh, mobile):
    kw = {"viewport": {"width": vw, "height": vh}, "device_scale_factor": 2 if mobile else 1}
    if mobile: kw["has_touch"] = True
    ctx = await b.new_context(**kw)
    errs = []
    pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=dft{name}&tb"); await pg.wait_for_timeout(1800)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Loser"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
    gold0 = await pg.evaluate(SETUP); await pg.wait_for_timeout(500)
    inv0 = await pg.evaluate("JSON.stringify(window.__dbg.save().inv)")
    await pg.click("#modal [data-act=enc][data-a=fight]"); await pg.wait_for_timeout(800)
    ok(await pg.evaluate("!!document.querySelector('#tbf') && TB.open"), f"{name}: the fight screen opens")
    await lose(pg)
    if BEFORE:
        if SHOTS: await pg.screenshot(path=os.path.join(SHOTS, f"defeatretry_before_{name}.png"))
        await ctx.close(); return
    ok(await pg.evaluate("!!document.querySelector('#dft') && !document.querySelector('#tbf')"), f"{name}: the defeat screen shows after the lost fight")
    ok(await pg.evaluate("!document.querySelector('#modal')"), f"{name}: not the old Defeated box")
    txt = await pg.evaluate("document.querySelector('#dft')?.innerText || ''")
    ok("Cave Troll" in txt or "cave troll" in txt.lower(), f"{name}: names the foe")
    ok(await pg.evaluate("!!document.querySelector('#dft .dft-why') && document.querySelector('#dft .dft-why').innerText.length > 10"), f"{name}: says why you lost: " + (await pg.evaluate("document.querySelector('#dft .dft-why')?.innerText || ''")))
    ok("lose nothing" in txt.lower(), f"{name}: says you lose nothing")
    for k in ["retry", "gear", "retreat"]:
        ok(await pg.evaluate(f"!!document.querySelector('#dft [data-dft={k}]')"), f"{name}: {k} button")
    hmin = await pg.evaluate("Math.min(...[...document.querySelectorAll('#dft .dft-b')].map(b=>b.getBoundingClientRect().height))")
    ok(hmin >= 44, f"{name}: big buttons ({hmin:.0f}px)")
    ok(await pg.evaluate("document.querySelector('#dft .dft-card').getBoundingClientRect().right <= window.innerWidth + 1 && document.documentElement.scrollWidth <= window.innerWidth"), f"{name}: fits the screen, no sideways scroll")
    ok(await pg.evaluate(f"window.__dbg.save().gold === {gold0}") and await pg.evaluate(f"JSON.stringify(window.__dbg.save().inv) === {inv0!r}"), f"{name}: no gold or items lost")
    ok(await pg.evaluate("window.__dbg.save().trip?.status === 'encounter'"), f"{name}: you're back just before the fight")
    if SHOTS: await pg.screenshot(path=os.path.join(SHOTS, f"defeatretry_after_{name}.png"))
    # difficulty chips
    if await pg.evaluate("!!document.querySelector('#dft [data-dfd=story]')"):
        await pg.click("#dft [data-dfd=story]"); await pg.wait_for_timeout(200)
        ok(await pg.evaluate("window.__dbg.save().diff === 'story' && !!document.querySelector('#dft [data-dfd=story].on')"), f"{name}: difficulty set to Story for the next try")
    # Adjust gear
    await pg.click("#dft [data-dft=gear]"); await pg.wait_for_timeout(600)
    ok(await pg.evaluate("!!document.querySelector('#sky') && !!document.querySelector('#dfbar') && getComputedStyle(document.querySelector('#dft')).display === 'none'"), f"{name}: Adjust gear opens Items with a bar to come back")
    if SHOTS: await pg.screenshot(path=os.path.join(SHOTS, f"defeatretry_gear_{name}.png"))
    await pg.click("#dfbar [data-dft=back]"); await pg.wait_for_timeout(400)
    ok(await pg.evaluate("!document.querySelector('#dfbar') && !document.querySelector('#sky') && getComputedStyle(document.querySelector('#dft')).display !== 'none'"), f"{name}: Back returns to the defeat screen")
    # Retry: the same foe
    await pg.click("#dft [data-dft=retry]"); await pg.wait_for_timeout(900)
    ok(await pg.evaluate("TB.open && /Cave Troll/.test(TB.session?.f?.e?.name || '')"), f"{name}: Retry starts the same fight again")
    await lose(pg)
    ok(await pg.evaluate("!!document.querySelector('#dft')"), f"{name}: lost again: the defeat screen again")
    ok(await pg.evaluate(f"window.__dbg.save().gold === {gold0}"), f"{name}: still nothing lost")
    # Retreat
    await pg.click("#dft [data-dft=retreat]"); await pg.wait_for_timeout(700)
    ok(await pg.evaluate("!document.querySelector('#dft') && window.__dbg.save().trip?.status === 'travel' && !window.__dbg.save().trip?.encounter"), f"{name}: Retreat: back on the road past the fight")
    ok(await pg.evaluate("!!document.querySelector('#modal') && /back on the road|Fell back/i.test(document.querySelector('#modal').innerText)"), f"{name}: says you fell back")
    if SHOTS: await pg.screenshot(path=os.path.join(SHOTS, f"defeatretry_retreat_{name}.png"))
    ok(not errs, f"{name}: no page errors {errs[:3]}")
    await ctx.close()

async def main():
    async with async_playwright() as p:
        kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if CHROME and os.path.exists(CHROME) else {}
        b = await p.chromium.launch(**kw)
        await run(b, "phone", 390, 844, True)
        await run(b, "pc", 1920, 1080, False)
        await b.close()
    print("RESULT OK" if not fails else f"RESULT FAIL ({len(fails)})")
asyncio.run(main())
