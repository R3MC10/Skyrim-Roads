"""Ward shield: casting a ward shows a shield bar on your fight frame that stays up between turns.
Usage: python3 ward_ui.py PORT"""
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
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=ward1&tb&fightanim"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Wardy"); await pg.click("#begin"); await pg.wait_for_timeout(3000)
        await pg.evaluate(START); await pg.wait_for_timeout(500)
        await pg.click("#modal [data-act=ev][data-c=fight]"); await pg.wait_for_timeout(900)
        ok(await pg.evaluate("TB.open"), "fight opens")
        for _ in range(40):
            if await pg.evaluate("!!document.querySelector('#tbf [data-tba=attack]')"): break
            await pg.wait_for_timeout(300)
        # cast the ward from the Magic list
        await pg.evaluate("()=>{ const m=document.querySelector('#tbf [data-tbm=magic]'); m&&m.click(); }"); await pg.wait_for_timeout(400)
        cast = await pg.evaluate("()=>{ const b=document.querySelector('#tbf [data-tba=\"spell:greater_ward\"]'); if(b){ b.click(); return true; } return false; }")
        if not cast:   # fall back: the engine casts it
            await pg.evaluate("()=>{ const f=TB.session.f; MAGIC.KINDS.ward(f, D.SPELLS.greater_ward); }")
        await pg.wait_for_timeout(1500)
        if not cast:   # end the turn so the screen redraws
            await pg.evaluate("()=>{ const e=document.querySelector('#tbf [data-tba=end]'); e&&e.click(); }")
        for _ in range(60):
            await pg.wait_for_timeout(300)
            if await pg.evaluate("!!document.querySelector('#tbf [data-tba=attack]:not([disabled])') || !!document.querySelector('#tbf .tbdone')"): break
        w = await pg.evaluate("TB.session ? [TB.session.f.ward, TB.session.f.wardMax] : null")
        ok(w and w[0] > 0, f"ward is up after the foe's turn {w} (cast from the list: {cast})")
        txt = await pg.evaluate("(document.querySelector('#tbf .tbward')||{}).innerText||''")
        ok("Ward" in txt, "shield bar on your frame: " + txt)
        await pg.wait_for_timeout(600); await pg.screenshot(path=OUT + "ward.png")
        ok(not errs, f"no page errors {errs}")
        await b.close()
    print("RESULT", "OK" if not fails else f"FAIL {len(fails)}")
asyncio.run(main())
