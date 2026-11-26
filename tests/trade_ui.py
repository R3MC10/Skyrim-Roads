import asyncio
import sys
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:" + PORT + "/index.html?net=bc&notut&p=tr"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Trader"); await pg.click("#begin"); await pg.wait_for_timeout(1000)
        await pg.evaluate("()=>{const S=window.__dbg.save(); S.location='Markarth'; [S.x,S.y]=WORLD.places.Markarth; S.discovered.push('Markarth'); G.give(S,'gem_ruby',3); G.give(S,'pelt_wolf',2); const t=Date.now()/1000; const day=24*3600/G.GAME_SPEED; while(!G.shopsOpen(G.now())) { G.__off=(G.__off||0); break; } }")
        open_ = await pg.evaluate("G.shopsOpen(G.now())"); print("shops open now:", open_)
        await pg.wait_for_timeout(400)
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        await pg.click("[data-tab=world]"); await pg.click("[data-tab=town]"); await pg.wait_for_timeout(300)
        await pg.click("[data-act=shop][data-id=general]"); await pg.wait_for_timeout(300)
        await pg.click("[data-act=smode][data-id=sell]"); await pg.wait_for_timeout(300)
        el = await pg.query_selector("#side"); await el.screenshot(path="trade_sell.png")
        g0 = await pg.evaluate("window.__dbg.save().gold")
        if open_:
            rid = await pg.evaluate("String(window.__dbg.save().inv.find(r=>r.item==='gem_ruby').id)")
            await pg.click(f"[data-act=sellall][data-id='{rid}']"); await pg.wait_for_timeout(400)
            print("gold", g0, "->", await pg.evaluate("window.__dbg.save().gold"), "rubies left", await pg.evaluate("SMITH.count(window.__dbg.save(),'gem_ruby')"))
        # mining
        await pg.click("[data-act=shop][data-id=mine]"); await pg.wait_for_timeout(300)
        print("mine (no pick):", (await pg.inner_text("#side"))[-160:].replace("\n"," | "))
        await pg.evaluate("()=>G.give(window.__dbg.save(),'pickaxe')"); await pg.click("[data-act=shop][data-id=mine]"); await pg.wait_for_timeout(200)
        await pg.click("[data-act=mine]"); await pg.wait_for_timeout(500)
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        print("ores:", await pg.evaluate("window.__dbg.save().inv.filter(r=>/^ore_|^gem_/.test(r.item)).map(r=>r.item+'×'+r.qty).join(', ')"))
        print("after:", (await pg.inner_text("#side"))[-130:].replace("\n"," | "))
        el = await pg.query_selector("#side"); await el.screenshot(path="mine_ui.png")
        print("errors:", errs)
        await b.close()
asyncio.run(main())
