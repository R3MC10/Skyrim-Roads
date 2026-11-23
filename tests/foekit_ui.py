"""Foe kits: foes use their moves in a real fight; chips on the foe frame show a raised shield, wind-up, ward...
Usage: python3 foekit_ui.py PORT"""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tbf") + os.sep
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)
START = """()=>{ document.querySelectorAll('#modal').forEach(m=>m.remove());
  const S=window.__dbg.save(); S.level=20; for (const k of ['One-Handed','Destruction','Restoration']) S.skills[k].lvl=60;
  S.mpBonus=300; for (const id of ['greater_ward','flames']) if (!S.spells.includes(id)) S.spells.push(id);
  G.setHealth(S,G.maxHealth(S)); S.dungeon=null; S.trip=null;
  S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
  const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }"""
async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2, has_touch=True)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=kit1&tb&fightanim"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Kitty"); await pg.click("#begin"); await pg.wait_for_timeout(3000)
        await pg.evaluate(START); await pg.wait_for_timeout(500)
        await pg.click("#modal [data-act=ev][data-c=fight]"); await pg.wait_for_timeout(900)
        ok(await pg.evaluate("TB.open"), "fight opens")
        for _ in range(40):
            if await pg.evaluate("!!document.querySelector('#tbf [data-tba=attack]')"): break
            await pg.wait_for_timeout(300)
        seen, chip = [], False
        for turn in range(12):
            for _ in range(60):
                if await pg.evaluate("!!document.querySelector('#tbf [data-tba=attack]:not([disabled])') || !!document.querySelector('#tbf .tbdone')"): break
                await pg.wait_for_timeout(300)
            if await pg.evaluate("!!document.querySelector('#tbf .tbdone')"): break
            await pg.evaluate("()=>{ const f=TB.session.f; f.hp=G.maxHealth(f.s); f.ehp=Math.max(f.ehp, TB.session.ehpMax*0.6); }")
            if await pg.evaluate("!!document.querySelector('#tbf .tbst .kit')") and not chip:
                chip = True; await pg.wait_for_timeout(500); await pg.screenshot(path=OUT + "foekit.png")
            await pg.evaluate("()=>{ const e=document.querySelector('#tbf [data-tba=end]'); e&&e.click(); }")
        seen = await pg.evaluate("TB.session ? Object.keys(TB.session.f.kit.used) : []")
        ids = await pg.evaluate("TB.session ? TB.session.f.kit.ids : []")
        ok(len(ids) > 0, f"the foe has a kit {ids}")
        ok(len(seen) > 0, f"it used kit moves {seen}")
        ok(chip, "a chip showed on the foe frame")
        tip = await pg.evaluate("(document.querySelector('#tbf .tbu.foe')||{dataset:{}}).dataset.tip||''")
        ok("Can use" in tip, "the foe tooltip lists its moves: " + tip[-90:])
        ok(not errs, f"no page errors {errs}")
        await b.close()
    print("RESULT", "OK" if not fails else f"FAIL {len(fails)}")
asyncio.run(main())
