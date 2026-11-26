"""Mining mini-game: open the rock face at Embershard Mine, strike a few stones, keep what you dug.
Usage: python3 minegame_ui.py PORT"""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tbf") + os.sep
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)
async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2, has_touch=True)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&minegame&p=mine1"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Miner"); await pg.click("#begin"); await pg.wait_for_timeout(2500)
        await pg.evaluate("""()=>{ const S=window.__dbg.save(); const l='Embershard Mine'; S.location=l; [S.x,S.y]=WORLD.places[l]; S.mined={}; S.trip=null;
          if(!SMITH.count(S,'pickaxe')) G.give(S,'pickaxe'); if(!S.discovered.includes(l)) S.discovered.push(l); }""")
        for t in ["world", "town"]:
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())"); await pg.evaluate(f"document.querySelector('[data-tab={t}]').click()"); await pg.wait_for_timeout(400)
        for _ in range(4):
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove()); document.querySelectorAll('.toast,#toast').forEach(m=>m.remove())"); await pg.wait_for_timeout(300)
        await pg.evaluate("document.querySelector('[data-act=mine]')?.click()"); await pg.wait_for_timeout(500)
        ok(await pg.query_selector("#minegame") is not None, "the rock face opens")
        ok(await pg.evaluate("document.querySelectorAll('#minegame .mgc').length") == 16, "16 stones")
        # strike every ore stone with a perfect blow (needle forced into the band), plus one blank rock
        await pg.evaluate("""()=>{ const st=MINEGAME.state(); const g=st.g; const ore=g.cells.map((c,i)=>[c,i]).filter(([c])=>c.kind!=='stone').map(([,i])=>i);
          const blank=g.cells.findIndex(c=>c.kind==='stone'); MINEGAME._hit(blank);
          for (const i of ore.slice(0,2)) { st.z={mid:0.5,good:1,perfect:1}; MINEGAME._hit(i); } }""")
        await pg.wait_for_timeout(250)
        got = await pg.evaluate("MINEGAME.total(MINEGAME.state().g.got)")
        ok(got >= 2, f"two veins broken out: {got} pieces")
        await pg.screenshot(path=OUT + "minegame.png")
        before = await pg.evaluate("SMITH.count(window.__dbg.save(),'ore_iron')+SMITH.count(window.__dbg.save(),'ore_corundum')+SMITH.count(window.__dbg.save(),'ore_silver')")
        await pg.wait_for_timeout(700)   # the blows land (the pickaxe swing) and the ore flies to the haul row
        ok(await pg.evaluate("document.querySelectorAll('#minegame .mgc.broken').length") >= 3, "broken stones show as holes")
        await pg.click("#mgdone"); await pg.wait_for_timeout(500)
        ok(await pg.query_selector("#minegame .mgres #mgok") is not None, "the haul card shows what you dug")
        await pg.screenshot(path=OUT + "minegame_haul.png")
        await pg.click("#mgok"); await pg.wait_for_timeout(500)
        after = await pg.evaluate("SMITH.count(window.__dbg.save(),'ore_iron')+SMITH.count(window.__dbg.save(),'ore_corundum')+SMITH.count(window.__dbg.save(),'ore_silver')")
        ok(await pg.query_selector("#minegame") is None and after > before, f"done: the ore is in your pack ({before} → {after})")
        ok(await pg.evaluate("SMITH.mineLeft(window.__dbg.save(),'Embershard Mine')") > 0, "the veins are bare now")
        ok(not errs, f"no page errors {errs}")
        await b.close()
    print("RESULT", "OK" if not fails else f"FAIL {len(fails)}")
asyncio.run(main())
