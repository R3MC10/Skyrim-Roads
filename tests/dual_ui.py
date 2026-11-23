"""Dual wielding: an item's "Left hand" button puts a second blade in your left hand, and the fight scene shows it.
Usage: python3 dual_ui.py PORT"""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tbf") + os.sep
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)
START = """()=>{ document.querySelectorAll('#modal').forEach(m=>m.remove());
  const S=window.__dbg.save(); S.level=12; G.setHealth(S,G.maxHealth(S)); S.dungeon=null; S.trip=null;
  S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
  const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }"""
async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2, has_touch=True)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=dual1&tb&fightanim"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Twin"); await pg.click("#begin"); await pg.wait_for_timeout(3000)
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        rid = await pg.evaluate("()=>{ const S=window.__dbg.save(); const id=G.give(S,'steel_sword'); G.equip(S,id); return G.give(S,'iron_war_axe'); }")
        await pg.click("[data-tab=pack]"); await pg.wait_for_timeout(400)
        await pg.evaluate("document.querySelector('[data-act=skycat][data-id=all]')?.click()"); await pg.wait_for_timeout(300)
        await pg.evaluate(f"document.querySelector(\"[data-act=skysel][data-id='{rid}']\")?.click()"); await pg.wait_for_timeout(300)
        btn = await pg.query_selector("[data-act=eqoff]")
        ok(btn is not None, "the axe has a Left hand button")
        if btn: await btn.click(); await pg.wait_for_timeout(400)
        await pg.screenshot(path=OUT + "dual_item.png")
        ok(await pg.evaluate(f"G.loadout(window.__dbg.save()).equipment.offhand=={rid}"), "the axe is in the left hand")
        await pg.evaluate(START); await pg.wait_for_timeout(500)
        await pg.click("#modal [data-act=ev][data-c=fight]"); await pg.wait_for_timeout(900)
        ok(await pg.evaluate("TB.open && !!TB.session.f.off"), "the fight sees the left-hand axe")
        for _ in range(40):
            if await pg.evaluate("!!document.querySelector('#tbf [data-tba=attack]:not([disabled])')"): break
            await pg.wait_for_timeout(300)
        await pg.evaluate("()=>{ document.querySelectorAll('[data-obt=off],[data-obt=ok]').forEach(b=>b.click()); }")
        await pg.click("#tbf [data-tba=attack]"); await pg.wait_for_timeout(1600)
        log = await pg.evaluate("(document.querySelector('#tbf .tblog')||document.querySelector('#tbf')).innerText")
        ok("left hand" in log, "the log shows the left-hand follow-up")
        await pg.screenshot(path=OUT + "dual_fight.png")
        ok(not errs, f"no page errors {errs}")
        await b.close()
    print("RESULT", "OK" if not fails else f"FAIL {len(fails)}")
asyncio.run(main())
