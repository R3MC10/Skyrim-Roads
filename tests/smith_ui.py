import asyncio
import sys
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        async def click(pg, sel):
            for _ in range(8):
                await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
                try: await pg.click(sel, timeout=2500); return
                except Exception: await pg.wait_for_timeout(300)
            await pg.click(sel, timeout=3000)
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:" + PORT + "/index.html?net=bc&notut&p=sm"); await pg.wait_for_timeout(1800)
        await click(pg, ".press"); await click(pg, ".mi[data-t=new]"); await pg.fill("#nm", "Smitty"); await click(pg, "#begin"); await pg.wait_for_timeout(1000)
        await pg.evaluate("()=>{const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.inv=S.inv.filter(r=>!/^mat_|^ore_/.test(r.item)); G.give(S,'mat_iron',4); G.give(S,'mat_strips',2); G.give(S,'ore_iron',4); G.give(S,'mat_gold',1); G.give(S,'gem_ruby',1);}")
        await pg.wait_for_timeout(500)
        for i in range(3):
            print("modal:", await pg.evaluate("document.querySelector('#modal')?.innerText?.slice(0,160)")); await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())"); await pg.wait_for_timeout(700)
        for _ in range(4):
            if await pg.query_selector("#modal [data-act=close]"): await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())"); await pg.wait_for_timeout(200)
        await click(pg, "[data-tab=map]"); await click(pg, "[data-tab=town]"); await pg.wait_for_timeout(300); await click(pg, "[data-id=forge]"); await pg.wait_for_timeout(300)
        el = await pg.query_selector("#side"); await el.screenshot(path="smith_make.png")
        await click(pg, "[data-act=smake][data-id=iron_sword]"); await pg.wait_for_timeout(400)
        print("made:", await pg.evaluate("[SMITH.count(window.__dbg.save(),'iron_sword'), SMITH.count(window.__dbg.save(),'mat_iron'), SMITH.count(window.__dbg.save(),'mat_strips')]"))
        await click(pg, "[data-act=fgroup][data-id=jewel]"); await pg.wait_for_timeout(300)
        await click(pg, "[data-act=smake][data-id=gold_ruby_ring]"); await pg.wait_for_timeout(400)
        print("ring:", await pg.evaluate("SMITH.count(window.__dbg.save(),'gold_ruby_ring')"))
        for _ in range(4):
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())"); await pg.wait_for_timeout(200)
        await click(pg, "[data-act=ftab][data-id=refine]"); await pg.wait_for_timeout(300)
        await click(pg, "[data-act=cqask][data-k=refine][data-id='0'][data-n=max]"); await pg.click("#modal [data-act=cqgo]"); await pg.wait_for_timeout(400)
        print("smelt:", await pg.evaluate("[SMITH.count(window.__dbg.save(),'ore_iron'), SMITH.count(window.__dbg.save(),'mat_iron')]"))
        el = await pg.query_selector("#side"); await el.screenshot(path="smith_refine.png")
        await click(pg, "[data-act=ftab][data-id=improve]"); await pg.wait_for_timeout(300)
        print("improve tab ok:", "Improve" in await pg.inner_text("#side"))
        print("errors:", errs)
        await b.close()
asyncio.run(main())
