"""Dragon raid: the gather card counts down, then the fight opens with the dragon in the air; it lands when badly hurt.
Usage: python3 dragon_ui.py PORT"""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tbf") + os.sep
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)
SETUP = """()=>{ document.querySelectorAll('#modal').forEach(m=>m.remove());
  const S=window.__dbg.save(); S.level=20; G.setHealth(S,G.maxHealth(S)); S.dungeon=null; S.trip=null; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun;
  if(!S.discovered.includes('Whiterun')) S.discovered.push('Whiterun');
  const now=G.now(); window.__raid={ id:'raid-test', town:'Whiterun', start:now-30, fightAt:now+200, end:now+1100, kind:'frost' };
  WEVENTS.activeRaid=()=>window.__raid; }"""
async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        exe = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
        b = await (p.chromium.launch(executable_path=exe, args=["--no-sandbox"]) if exe else p.chromium.launch(args=["--no-sandbox"]))
        ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2, has_touch=True)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=drag1&tb&fightanim"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Sigrid"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        await pg.evaluate("()=>{ const o=document.querySelector('[data-obt=off]'); o&&o.click(); }")
        await pg.evaluate(SETUP); await pg.wait_for_timeout(2500)
        txt = await pg.evaluate("(document.querySelector('#raid')||{}).innerText||''")
        ok("circling" in txt and "frost dragon" in txt.lower(), "the gather card names the frost dragon circling: " + txt[:120].replace("\n", " "))
        ok(await pg.evaluate("!!document.querySelector('#raid button[disabled]')"), "you wait for it (no fight button yet)")
        ok(await pg.evaluate("window.__dbg.save().raid && window.__dbg.save().raid.id==='raid-test'"), "being in the town counts you in")
        el = await pg.query_selector("#raid")
        if el: await el.screenshot(path=OUT + "dragon_gather.png")
        # the timer runs out: the fight opens by itself
        await pg.evaluate("()=>{ window.__raid.fightAt=G.now()-1; }")
        for _ in range(8):   # quest and achievement popups wait in front; the dragon dives once they're closed
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())"); await pg.wait_for_timeout(500)
            if await pg.evaluate("TB.open"): break
        await pg.evaluate("()=>{ const o=document.querySelector('[data-obt=off]'); o&&o.click(); }")
        ok(await pg.evaluate("!!document.querySelector('#tbf') && TB.open"), "the fight opens when the timer runs out")
        ok(await pg.evaluate("TB.session && TB.session.f.dStance==='air'"), "the dragon starts in the air")
        ok(await pg.evaluate("/Frost Dragon/.test(TB.session.f.e.name)"), "it's the raid's kind")
        await pg.evaluate("()=>{ const o=document.querySelector('[data-obt=off]'); o&&o.click(); document.querySelectorAll('[data-obt=ok]').forEach(b=>b.click()); }")
        for sel in ["[data-obt=off]", "[data-obt=ok]"]:
            try: await pg.locator(sel).first.click(timeout=1500)
            except Exception: pass
        await pg.wait_for_timeout(800); await pg.screenshot(path=OUT + "dragon_air.png")
        await pg.evaluate("()=>{ const ss=TB.session, f=ss.f; f.ehp=f.e.pool*0.2; DRAGONS.check(f, ss); }")
        await pg.wait_for_timeout(1200)
        ok(await pg.evaluate("TB.session.f.dStance==='ground'"), "it lands when badly hurt")
        await pg.screenshot(path=OUT + "dragon_ground.png")
        ok(not errs, f"no page errors {errs}")
        await b.close()
    print("RESULT", "OK" if not fails else f"FAIL {len(fails)}")
asyncio.run(main())
